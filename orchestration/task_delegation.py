#!/usr/bin/env python3
"""
Task Delegation System
Assigns tasks from Nervix API to nanobot fleet
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TaskDelegator:
    """Delegates tasks to nanobots based on capabilities"""

    def __init__(self, api_url: str = "http://localhost:3001/v1"):
        self.api_url = api_url
        self.fleet_file = "/root/nanobot/fleet_status.json"
        self.assignment_file = "/root/.openclaw/workspace/nervix/orchestration/task_assignments.json"
        self.assignments = self._load_assignments()

    def _load_assignments(self) -> Dict:
        """Load existing task assignments"""
        try:
            with open(self.assignment_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {"assignments": [], "last_updated": None}

    def _save_assignments(self):
        """Save task assignments to file"""
        self.assignments["last_updated"] = datetime.now().isoformat()
        with open(self.assignment_file, 'w') as f:
            json.dump(self.assignments, f, indent=2)

    def _load_fleet(self) -> List[Dict]:
        """Load nanobot fleet status"""
        try:
            with open(self.fleet_file, 'r') as f:
                fleet_data = json.load(f)
                return fleet_data.get('agents', [])
        except Exception as e:
            logger.error(f"Failed to load fleet: {e}")
            return []

    def _match_task_to_agent(self, task: Dict, agent: Dict) -> float:
        """Calculate match score between task and agent capabilities

        Returns score between 0.0 and 1.0
        """
        task_capabilities = set(task.get('requirements', {}).get('capabilities', []))
        agent_capabilities = set(agent.get('capabilities', []))

        if not task_capabilities:
            # Task has no specific requirements
            return 1.0

        # Calculate intersection
        matching = len(task_capabilities & agent_capabilities)
        score = matching / len(task_capabilities)

        logger.debug(f"Match: {task.get('type')} -> {agent.get('name')}: {score:.2f}")
        return score

    def _find_best_agent(self, task: Dict, fleet: List[Dict]) -> Optional[Dict]:
        """Find the best agent for a task based on capabilities"""

        available_agents = [
            agent for agent in fleet
            if agent.get('status') == 'online'
        ]

        if not available_agents:
            return None

        # Score all agents
        scored_agents = []
        for agent in available_agents:
            score = self._match_task_to_agent(task, agent)
            scored_agents.append((score, agent))

        # Sort by score descending
        scored_agents.sort(key=lambda x: x[0], reverse=True)

        # Return best agent if score > 0.3
        if scored_agents and scored_agents[0][0] > 0.3:
            return scored_agents[0][1]

        return None

    def fetch_available_tasks(self) -> List[Dict]:
        """Fetch available tasks from API"""
        try:
            response = requests.get(f"{self.api_url}/tasks/available", timeout=5)
            response.raise_for_status()
            tasks = response.json()

            logger.info(f"Fetched {len(tasks)} available tasks")
            return tasks
        except Exception as e:
            logger.error(f"Failed to fetch tasks: {e}")
            return []

    def claim_task(self, task_id: str, agent_id: str) -> Optional[Dict]:
        """Claim a task for an agent"""
        try:
            response = requests.post(
                f"{self.api_url}/tasks/{task_id}/claim",
                json={"agent_id": agent_id},
                timeout=5
            )
            response.raise_for_status()
            result = response.json()

            logger.info(f"Claimed task {task_id} for agent {agent_id}")
            return result
        except Exception as e:
            logger.error(f"Failed to claim task {task_id}: {e}")
            return None

    def delegate_tasks(self, max_tasks: int = 5) -> int:
        """Main delegation loop

        Returns number of tasks delegated
        """
        logger.info("Starting task delegation...")

        # Load fleet
        fleet = self._load_fleet()
        logger.info(f"Fleet status: {len(fleet)} agents")

        # Fetch available tasks
        tasks = self.fetch_available_tasks()

        if not tasks:
            logger.info("No available tasks to delegate")
            return 0

        delegated_count = 0
        tasks_to_delegate = tasks[:max_tasks]

        for task in tasks_to_delegate:
            task_id = task.get('id')
            task_type = task.get('type')

            # Check if already assigned
            if task_id in [a.get('task_id') for a in self.assignments.get('assignments', [])]:
                logger.debug(f"Task {task_id} already assigned")
                continue

            # Find best agent
            agent = self._find_best_agent(task, fleet)

            if not agent:
                logger.warning(f"No suitable agent for task {task_type}")
                continue

            agent_id = agent.get('id')

            # Claim task
            result = self.claim_task(task_id, agent_id)

            if result and result.get('success'):
                # Record assignment
                assignment = {
                    "task_id": task_id,
                    "agent_id": agent_id,
                    "agent_name": agent.get('name'),
                    "task_type": task_type,
                    "task_title": task.get('parameters', {}).get('title', 'Untitled'),
                    "reward": task.get('base_reward'),
                    "claimed_at": datetime.now().isoformat(),
                    "assignment_token": result.get('data', {}).get('assignment_token')
                }

                self.assignments['assignments'].append(assignment)
                delegated_count += 1

                logger.info(f"✓ Delegated: {task_type} (${task.get('base_reward')}) -> {agent.get('name')}")

                # Update agent availability
                agent['available'] = False
                agent['current_task'] = task_id

        # Save assignments
        if delegated_count > 0:
            self._save_assignments()
            self._save_fleet(fleet)

        logger.info(f"Delegation complete: {delegated_count}/{len(tasks_to_delegate)} tasks assigned")
        return delegated_count

    def _save_fleet(self, fleet: List[Dict]):
        """Save updated fleet status"""
        fleet_data = {
            "last_updated": datetime.now().isoformat(),
            "total_agents": len(fleet),
            "online_agents": len([a for a in fleet if a.get('status') == 'online']),
            "agents": fleet
        }
        with open(self.fleet_file, 'w') as f:
            json.dump(fleet_data, f, indent=2)

    def get_assignments(self) -> List[Dict]:
        """Get current task assignments"""
        return self.assignments.get('assignments', [])

    def print_status(self):
        """Print delegation status"""
        assignments = self.get_assignments()

        print("\n" + "="*60)
        print("TASK DELEGATION STATUS")
        print("="*60)
        print(f"Total assignments: {len(assignments)}")
        print(f"Last updated: {self.assignments.get('last_updated', 'Never')}")

        if assignments:
            print("\nActive Assignments:")
            for i, assignment in enumerate(assignments[-5:], 1):  # Show last 5
                print(f"  {i}. {assignment.get('task_title')} -> {assignment.get('agent_name')}")

        # Fleet status
        fleet = self._load_fleet()
        online = len([a for a in fleet if a.get('status') == 'online'])
        print(f"\nFleet: {online}/{len(fleet)} agents online")
        print("="*60 + "\n")


def main():
    """Main execution"""
    delegator = TaskDelegator()

    # Run delegation
    count = delegator.delegate_tasks(max_tasks=10)

    # Print status
    delegator.print_status()

    return count


if __name__ == '__main__':
    import sys
    try:
        count = main()
        sys.exit(0 if count >= 0 else 1)
    except KeyboardInterrupt:
        logger.info("Delegation interrupted")
        sys.exit(0)
