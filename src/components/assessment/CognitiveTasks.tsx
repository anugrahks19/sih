import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { InteractionLog, CognitiveScores } from "@/services/api";

export interface CognitiveTask {
  id: string;
  type: "word-recall" | "digit-span" | "tapping" | "clock-drawing" | "attention";
  title: string;
  description: string;
  prompt: string;
  options?: string[];
  correctAnswer?: number;
  durationMs?: number;
  // When provided, this task expects the user to tap options in this exact order (by index)
  sequenceAnswer?: number[];
}

export interface CognitiveCompletionPayload {
  logs: InteractionLog[];
  scores: CognitiveScores;
  clockDrawing?: string;
}

interface CognitiveTasksProps {
  tasks: CognitiveTask[];
  onComplete: (payload: CognitiveCompletionPayload) => Promise<void>;
  isSubmitting?: boolean;
}

interface TaskState {
  startTime: number | null;
  responseTimeMs: number;
  correct: boolean | null;
  errors: number;
  selectedOption?: number;
  freeResponse?: string;
  // For sequence-based tasks (e.g., word-recall), record the chosen order of option indices
  sequence?: number[];
}

export const CognitiveTasks = ({ tasks, onComplete, isSubmitting }: CognitiveTasksProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({});
  const [isFinished, setIsFinished] = useState(false);
  const currentTask = useMemo(() => tasks[currentIndex], [tasks, currentIndex]);

  const startTaskTimer = (taskId: string) => {
    setTaskStates((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? { responseTimeMs: 0, correct: null, errors: 0 }),
        startTime: performance.now(),
      },
    }));
  };

  const completeTask = async (taskId: string, overrides?: Partial<TaskState>) => {
    setTaskStates((prev) => {
      const currentState = prev[taskId];
      if (!currentState?.startTime) return prev;

      const responseTimeMs = overrides?.responseTimeMs ?? performance.now() - currentState.startTime;

      return {
        ...prev,
        [taskId]: {
          ...currentState,
          ...overrides,
          startTime: null,
          responseTimeMs,
        },
      };
    });

    if (currentIndex < tasks.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handleOptionSelect = (task: CognitiveTask, optionIndex: number) => {
    if (!taskStates[task.id]?.startTime) {
      toast({ title: "Start the task first", description: "Press Begin before answering." });
      return;
    }

    // Sequence mode: accumulate ordered selections without auto-complete
    if (task.sequenceAnswer && task.options) {
      setTaskStates((prev) => {
        const cur: TaskState = prev[task.id] ?? {
          startTime: null,
          responseTimeMs: 0,
          correct: null,
          errors: 0,
        };
        const seq = cur.sequence ?? [];
        // prevent duplicates and limit length
        if (seq.includes(optionIndex) || seq.length >= task.sequenceAnswer!.length) {
          return prev;
        }
        return {
          ...prev,
          [task.id]: {
            ...cur,
            sequence: [...seq, optionIndex],
          },
        };
      });
      return;
    }

    // Single-choice mode
    const isCorrect = task.correctAnswer !== undefined ? optionIndex === task.correctAnswer : null;
    setTaskStates((prev) => ({
      ...prev,
      [task.id]: {
        ...(prev[task.id] ?? { startTime: null, responseTimeMs: 0, correct: null, errors: 0 }),
        selectedOption: optionIndex,
        correct: isCorrect,
      },
    }));

    completeTask(task.id, { correct: isCorrect, selectedOption: optionIndex });
  };

  const handleFinish = async () => {
    try {
      const logs: InteractionLog[] = tasks.map((task) => {
        const state = taskStates[task.id];
        const metadata = task.sequenceAnswer
          ? {
              expectedSequence: task.sequenceAnswer,
              selectedSequence: state?.sequence ?? [],
            }
          : undefined;
        return {
          taskId: task.id,
          taskType: "cognitive",
          prompt: task.prompt,
          responseTimeMs: state?.responseTimeMs ?? 0,
          correct: state?.correct ?? null,
          errors: state?.errors,
          metadata,
        };
      });

      const scores = tasks.reduce(
        (acc, task) => {
          const state = taskStates[task.id];
          const baseScore = state?.correct ? 1 : 0;
          const penalty = (state?.errors ?? 0) * 0.1;
          const adjustedScore = Math.max(0, baseScore - penalty);

          if (task.type === "word-recall") acc.memoryScore += adjustedScore;
          if (task.type === "digit-span" || task.type === "attention") acc.attentionScore += adjustedScore;
          if (task.type === "clock-drawing") acc.executiveScore += adjustedScore;
          if (task.type === "tapping") acc.languageScore += adjustedScore;

          return acc;
        },
        {
          memoryScore: 0,
          attentionScore: 0,
          languageScore: 0,
          executiveScore: 0,
        } satisfies CognitiveScores,
      );

      // Include free-response from clock-drawing task if present
      const clock = tasks.find((t) => t.type === "clock-drawing");
      const clockDrawing = clock ? taskStates[clock.id]?.freeResponse : undefined;

      await onComplete({
        logs,
        scores,
        clockDrawing,
      });

      toast({ title: "Cognitive tasks submitted" });
    } catch (error) {
      console.error(error);
      toast({
        title: "Submission failed",
        description: "Could not submit cognitive responses. Please try again.",
      });
    }
  };

  const progress = Math.round(((currentIndex + (isFinished ? 1 : 0)) / tasks.length) * 100);

  if (!currentTask) {
    return null;
  }

  // Hide the prompt after Begin for recall-style tasks
  const showPrompt = !(
    (currentTask.type === "word-recall" || currentTask.type === "digit-span") &&
    !!taskStates[currentTask.id]?.startTime
  );

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{currentTask.title}</CardTitle>
            <span className="text-sm text-muted-foreground">{currentTask.description}</span>
          </div>
          <Badge variant="secondary">
            Task {currentIndex + 1} / {tasks.length}
          </Badge>
        </div>
        <Progress value={progress} className="mt-4" />
      </CardHeader>

      <CardContent className="space-y-6">
        {showPrompt && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Prompt:</span> {currentTask.prompt}
            </p>
          </div>
        )}

        {/* Free-response for clock drawing */}
        {currentTask.type === "clock-drawing" && (
          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">Describe your clock drawing (optional)</label>
            <textarea
              className="w-full rounded-md border bg-background p-3 text-sm"
              rows={4}
              placeholder="Example: Numbers 1-12 placed evenly, hour hand near 11, minute hand at 2 (10 minutes)..."
              value={taskStates[currentTask.id]?.freeResponse ?? ""}
              onChange={(e) =>
                setTaskStates((prev) => ({
                  ...prev,
                  [currentTask.id]: {
                    ...(prev[currentTask.id] ?? { startTime: null, responseTimeMs: 0, correct: null, errors: 0 }),
                    freeResponse: e.target.value,
                  },
                }))
              }
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={!!taskStates[currentTask.id]?.startTime}
            onClick={() => startTaskTimer(currentTask.id)}
          >
            Begin
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              // If the task has choices (sequence or options), require Begin; else allow Complete
              ((currentTask.sequenceAnswer || (currentTask.options && currentTask.options.length > 0))
                ? !taskStates[currentTask.id]?.startTime
                : false)
            }
            onClick={() => {
              // For sequence tasks, compute correctness/errors at completion
              if (currentTask.sequenceAnswer) {
                const state = taskStates[currentTask.id];
                const seq = state?.sequence ?? [];
                const expected = currentTask.sequenceAnswer;
                const len = Math.max(expected.length, seq.length);
                let mismatches = 0;
                for (let i = 0; i < len; i++) {
                  if (expected[i] !== seq[i]) mismatches++;
                }
                const isCorrect = mismatches === 0 && seq.length === expected.length;
                completeTask(currentTask.id, { correct: isCorrect, errors: mismatches });
              } else {
                // For no-input tasks (e.g., clock-drawing), allow completing even if Begin wasn't clicked
                const noInput = !currentTask.options || currentTask.options.length === 0;
                if (noInput && !taskStates[currentTask.id]?.startTime) {
                  startTaskTimer(currentTask.id);
                }
                // Mark clock-drawing as correct so it contributes to executive score
                const markCorrect = currentTask.type === "clock-drawing" ? { correct: true } : undefined;
                completeTask(currentTask.id, markCorrect);
              }
            }}
          >
            Complete
          </Button>
        </div>

        {/* Selected sequence visualizer */}
        {currentTask.sequenceAnswer && taskStates[currentTask.id]?.sequence && (
          <div className="flex flex-wrap items-center gap-2">
            {(taskStates[currentTask.id]?.sequence ?? []).map((idx, i) => (
              <span key={`${idx}-${i}`} className="px-2 py-1 text-xs rounded-md border bg-muted/50">
                {i + 1}. {currentTask.options?.[idx]}
              </span>
            ))}
            {!!(taskStates[currentTask.id]?.sequence?.length) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setTaskStates((prev) => {
                    const cur = prev[currentTask.id];
                    if (!cur?.sequence?.length) return prev;
                    const next = [...cur.sequence];
                    next.pop();
                    return { ...prev, [currentTask.id]: { ...cur, sequence: next } };
                  })
                }
              >
                Undo
              </Button>
            )}
          </div>
        )}

        {currentTask.options && (
          <div className="grid gap-3">
            {currentTask.options.map((option, index) => (
              <Button
                key={option}
                variant={
                  // Highlight if chosen in sequence or selected in single-choice
                  currentTask.sequenceAnswer
                    ? (taskStates[currentTask.id]?.sequence ?? []).includes(index)
                      ? "default"
                      : "outline"
                    : taskStates[currentTask.id]?.selectedOption === index
                      ? "default"
                      : "outline"
                }
                className="justify-start"
                disabled={
                  !taskStates[currentTask.id]?.startTime ||
                  (currentTask.sequenceAnswer
                    ? (taskStates[currentTask.id]?.sequence ?? []).includes(index)
                    : false)
                }
                onClick={() => handleOptionSelect(currentTask, index)}
              >
                {option}
              </Button>
            ))}
          </div>
        )}

        {isFinished && (
          <Button size="lg" className="w-full" onClick={handleFinish} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Cognitive Data"}
          </Button>
        )}
      </CardContent>
    </Card>
  );

}
