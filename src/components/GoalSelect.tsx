import React from 'react';
import { Activity, goalNames } from '../types/activity';

interface GoalSelectProps {
  activities: Activity[];
  /** 'all' or a goal name. */
  value: string;
  onChange: (goal: string) => void;
  className?: string;
}

/** Goal filter. Each option shows how many of that goal's tasks are done. */
export const GoalSelect: React.FC<GoalSelectProps> = ({ activities, value, onChange, className }) => {
  const goals = goalNames(activities);
  if (goals.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filter by goal"
      className={className}
    >
      <option value="all">All goals</option>
      {goals.map((goal) => {
        const tasks = activities.filter((a) => a.goal === goal);
        const done = tasks.filter((a) => a.status === 'completed').length;
        return (
          <option key={goal} value={goal}>
            {goal} · {done}/{tasks.length}
          </option>
        );
      })}
    </select>
  );
};
