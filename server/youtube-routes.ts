import type { Express, Request, Response } from "express";
import * as db from "./db";
import { authenticateRequest } from "./_core/sdk";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
].join(" ");

// ─── Helper: Refresh YouTube token if expired ────────────────────────────────
async function refreshTokenIfNeeded(channel: any): Promise<string> {
  const expiresAt = new Date(channel.token_expires_at).getTime();
  if (Date.now() < expiresAt - 60000) return channel.access_token;

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: channel.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json() as any;
  if (!data.access_token) throw new Error("Failed to refresh YouTube token");

  const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await db.updateYouTubeChannel(channel.id, {
    access_token: data.access_token,
    token_expires_at: newExpiry,
  });
  return data.access_token;
}

// ─── Helper: Fetch YouTube channel info ──────────────────────────────────────
async function fetchYouTubeChannelInfo(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json() as any;
  if (!data.items || data.items.length === 0) throw new Error("No YouTube channel found for this account");
  const ch = data.items[0];
  return {
    channel_id: ch.id,
    channel_title: ch.snippet.title,
    channel_thumbnail: ch.snippet.thumbnails?.default?.url || null,
    subscriber_count: parseInt(ch.statistics.subscriberCount) || 0,
    video_count: parseInt(ch.statistics.videoCount) || 0,
    view_count: parseInt(ch.statistics.viewCount) || 0,
  };
}

// ─── Helper: Sync videos from YouTube API ────────────────────────────────────
async function syncChannelVideos(channel: any, accessToken: string, maxResults: number = 50) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channel.channel_id}&type=video&order=date&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await res.json() as any;
  const videoIds = (searchData.items || []).map((i: any) => i.id.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const detailRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${videoIds.join(",")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const detailData = await detailRes.json() as any;

  const videos = [];
  for (const v of detailData.items || []) {
    const video = {
      channel_id: channel.id,
      user_id: channel.user_id,
      video_id: v.id,
      title: v.snippet.title,
      description: (v.snippet.description || "").substring(0, 5000),
      thumbnail_url: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.default?.url || null,
      status: v.status.privacyStatus || "published",
      duration: v.contentDetails.duration || null,
      view_count: parseInt(v.statistics.viewCount) || 0,
      like_count: parseInt(v.statistics.likeCount) || 0,
      comment_count: parseInt(v.statistics.commentCount) || 0,
      published_at: v.snippet.publishedAt || null,
      tags: v.snippet.tags || [],
      category: v.snippet.categoryId || null,
      last_synced_at: new Date().toISOString(),
    };
    await db.upsertYouTubeVideo(video);
    videos.push(video);
  }

  await db.updateYouTubeChannel(channel.id, {
    last_synced_at: new Date().toISOString(),
    video_count: videos.length,
  });

  return videos;
}

export function registerYouTubeRoutes(app: Express) {

  // ─── YouTube OAuth: Start Connect Flow ──────────────────────────────────
  app.get("/api/youtube/connect", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      const sub = await db.getSubscription((user as any).id);
      const channels = await db.listYouTubeChannels((user as any).id);
      const maxChannels = sub?.max_channels || 1;
      if (channels.length >= maxChannels) {
        res.status(403).json({ error: `Plan limit reached. Max ${maxChannels} channel(s). Upgrade to connect more.` });
        return;
      }
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) { res.status(500).json({ error: "Google OAuth not configured" }); return; }
      const appUrl = process.env.APP_URL || "https://nervix.ai";
      const state = Buffer.from(JSON.stringify({ openId: (user as any).openId })).toString("base64url");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${appUrl}/api/youtube/callback`,
        response_type: "code",
        scope: `openid email profile ${YOUTUBE_SCOPES}`,
        access_type: "offline",
        prompt: "consent",
        state,
      });
      res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Authentication required" });
    }
  });

  // ─── YouTube OAuth: Callback ────────────────────────────────────────────
  app.get("/api/youtube/callback", async (req: Request, res: Response) => {
    const { code, error, state } = req.query as Record<string, string>;
    if (error || !code) { res.redirect("/dashboard?error=youtube_cancelled"); return; }
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
      const user = await db.getUserByOpenId(stateData.openId);
      if (!user) { res.redirect("/dashboard?error=user_not_found"); return; }
      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      const appUrl = process.env.APP_URL || "https://nervix.ai";

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: `${appUrl}/api/youtube/callback`, grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) throw new Error("No access token from Google");
      if (!tokenData.refresh_token) throw new Error("No refresh token. User may need to revoke and reconnect.");

      // Fetch YouTube channel info
      const channelInfo = await fetchYouTubeChannelInfo(tokenData.access_token);
      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      // Save channel
      await db.createYouTubeChannel({
        user_id: (user as any).id,
        ...channelInfo,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        scopes: tokenData.scope || YOUTUBE_SCOPES,
      });

      res.redirect("/dashboard?youtube=connected");
    } catch (err: any) {
      console.error("[YouTube] OAuth callback failed:", err);
      res.redirect(`/dashboard?error=youtube_failed&message=${encodeURIComponent(err.message)}`);
    }
  });

  // ─── List Connected Channels ────────────────────────────────────────────
  app.get("/api/youtube/channels", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      const channels = await db.listYouTubeChannels((user as any).id);
      const sub = await db.getSubscription((user as any).id);
      res.json({ channels, subscription: { plan: sub?.plan || "free", max_channels: sub?.max_channels || 1 } });
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Authentication required" });
    }
  });

  // ─── Disconnect Channel ─────────────────────────────────────────────────
  app.delete("/api/youtube/channels/:id", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      const channel = await db.getYouTubeChannelById(req.params.id);
      if (!channel || channel.user_id !== (user as any).id) {
        res.status(404).json({ error: "Channel not found" }); return;
      }
      await db.deleteYouTubeChannel(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Authentication required" });
    }
  });

  // ─── Sync Videos for a Channel ──────────────────────────────────────────
  app.post("/api/youtube/channels/:id/sync", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      const channel = await db.getYouTubeChannelById(req.params.id);
      if (!channel || channel.user_id !== (user as any).id) {
        res.status(404).json({ error: "Channel not found" }); return;
      }
      const accessToken = await refreshTokenIfNeeded(channel);

      // Refresh channel stats
      const channelInfo = await fetchYouTubeChannelInfo(accessToken);
      await db.updateYouTubeChannel(channel.id, {
        channel_title: channelInfo.channel_title,
        subscriber_count: channelInfo.subscriber_count,
        video_count: channelInfo.video_count,
        view_count: channelInfo.view_count,
      });

      // Sync videos
      const videos = await syncChannelVideos(channel, accessToken);
      res.json({ success: true, synced: videos.length, channel: channelInfo });
    } catch (err: any) {
      console.error("[YouTube] Sync failed:", err);
      res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  // ─── List Videos ────────────────────────────────────────────────────────
  app.get("/api/youtube/videos", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      const { channelId, status, limit, offset } = req.query as Record<string, string>;
      const result = await db.listYouTubeVideos((user as any).id, {
        channelId: channelId || undefined,
        status: status || undefined,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Authentication required" });
    }
  });

  // ─── Video Stats ────────────────────────────────────────────────────────
  app.get("/api/youtube/stats", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      const stats = await db.getYouTubeVideoStats((user as any).id);
      const channels = await db.listYouTubeChannels((user as any).id);
      const sub = await db.getSubscription((user as any).id);
      res.json({ ...stats, totalChannels: channels.length, subscription: sub?.plan || "free" });
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Authentication required" });
    }
  });

  // ─── Subscription Info ──────────────────────────────────────────────────
  app.get("/api/youtube/subscription", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      let sub = await db.getSubscription((user as any).id);
      if (!sub) {
        await db.createSubscription((user as any).id, "free");
        sub = await db.getSubscription((user as any).id);
      }
      res.json(sub);
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Authentication required" });
    }
  });
}
