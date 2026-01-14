import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";

export interface TimelineEvent {
  id: string;
  type: "tool" | "thinking" | "response" | "error" | "info";
  name: string;
  status: "running" | "success" | "error" | "pending";
  timestamp: number;
  duration?: number;
  details?: string;
  metadata?: Record<string, unknown>;
}

interface TimelineProps {
  events: TimelineEvent[];
  maxHeight?: number;
  showTimestamps?: boolean;
}

const statusIcons = {
  running: <Spinner type="dots" />,
  success: figures.tick,
  error: figures.cross,
  pending: figures.ellipsis,
};

const statusColors = {
  running: "yellow",
  success: "green",
  error: "red",
  pending: "gray",
};

const typeIcons = {
  tool: figures.play,
  thinking: "🧠",
  response: figures.arrowRight,
  error: figures.warning,
  info: figures.info,
};

const typeColors = {
  tool: "cyan",
  thinking: "magenta",
  response: "green",
  error: "red",
  info: "blue",
};

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export const Timeline: React.FC<TimelineProps> = ({
  events,
  maxHeight = 20,
  showTimestamps = true,
}) => {
  const visibleEvents = events.slice(-maxHeight);

  if (events.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="gray" dimColor>
          No activity yet
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          {figures.star} Activity Timeline
        </Text>
        <Text color="gray" dimColor>
          <Text>{events.length}</Text> events
        </Text>
      </Box>

      <Box flexDirection="column">
        {visibleEvents.map((event, idx) => {
          const isRunning = event.status === "running";
          const statusColor = statusColors[event.status];
          const typeColor = typeColors[event.type];
          const statusIcon = statusIcons[event.status];
          const typeIcon = typeIcons[event.type];

          return (
            <Box key={event.id} flexDirection="column" marginBottom={1}>
              {/* Main Event Line */}
              <Box gap={1}>
                {/* Connection Line */}
                {idx < visibleEvents.length - 1 && (
                  <Box width={1}>
                    <Text color="gray" dimColor>
                      │
                    </Text>
                  </Box>
                )}

                {/* Status Icon */}
                <Box width={2}>
                  {isRunning ? (
                    <Text color={statusColor}>{statusIcon}</Text>
                  ) : (
                    <Text color={statusColor}>{statusIcon}</Text>
                  )}
                </Box>

                {/* Type Icon */}
                <Text color={typeColor}>{typeIcon}</Text>

                {/* Event Name */}
                <Text bold={isRunning} color={isRunning ? "white" : undefined}>
                  {event.name}
                </Text>

                {/* Duration */}
                {event.duration && (
                  <Text color="gray" dimColor>
                    ({formatDuration(event.duration)})
                  </Text>
                )}

                {/* Timestamp */}
                {showTimestamps && (
                  <Text color="gray" dimColor>
                    {formatTime(event.timestamp)}
                  </Text>
                )}
              </Box>

              {/* Event Details */}
              {event.details && (
                <Box paddingLeft={4}>
                  <Text color="gray" dimColor wrap="truncate">
                    {figures.arrowRight} {event.details}
                  </Text>
                </Box>
              )}

              {/* Metadata */}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <Box paddingLeft={4} gap={2}>
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <Text key={key} color="gray" dimColor>
                      {key}: {String(value)}
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {events.length > maxHeight && (
        <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
          <Text color="gray" dimColor>
            Showing <Text>{visibleEvents.length}</Text> of <Text>{events.length}</Text> events
          </Text>
        </Box>
      )}
    </Box>
  );
};

export const CompactTimeline: React.FC<{ events: TimelineEvent[] }> = ({
  events,
}) => {
  const runningEvents = events.filter((e) => e.status === "running");
  const recentSuccess = events
    .filter((e) => e.status === "success")
    .slice(-3);

  if (runningEvents.length === 0 && recentSuccess.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" gap={0}>
      {runningEvents.map((event) => (
        <Box key={event.id} gap={1}>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text color="yellow">{event.name}</Text>
          {event.duration && (
            <Text color="gray" dimColor>
              {formatDuration(event.duration)}
            </Text>
          )}
        </Box>
      ))}
      {recentSuccess.length > 0 && (
        <Box gap={1}>
          <Text color="green">{figures.tick}</Text>
          <Text color="gray" dimColor>
            <Text>{recentSuccess.length}</Text> completed
          </Text>
        </Box>
      )}
    </Box>
  );
};
