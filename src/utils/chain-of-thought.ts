import { v4 as uuidv4 } from 'uuid';
import type { AgentRole, ChainOfThought, CoTStep } from '../types/agent.js';

const MARKERS: Record<CoTStep['step'], string[]> = {
  observation: ['【观察】', '[Observation]', '## Observation', '观察：'],
  analysis: ['【分析】', '[Analysis]', '## Analysis', '分析：'],
  reasoning: ['【推理】', '[Reasoning]', '## Reasoning', '推理：'],
  decision: ['【决策】', '[Decision]', '## Decision', '决策：'],
  action: ['【行动】', '[Action]', '## Action', '行动：'],
};

const STEP_TITLES: Record<CoTStep['step'], string> = {
  observation: '观察',
  analysis: '分析',
  reasoning: '推理',
  decision: '决策',
  action: '行动',
};

const STEP_TYPES: Array<CoTStep['step']> = ['observation', 'analysis', 'reasoning', 'decision', 'action'];

export function extractChainOfThought(
  content: string,
  agentRole: AgentRole,
  startTime: number,
  endTime: number,
): ChainOfThought {
  const totalDuration = Math.max(0, endTime - startTime);
  const steps: CoTStep[] = [];

  for (const stepType of STEP_TYPES) {
    let stepContent = '';
    for (const marker of MARKERS[stepType]) {
      const markerIndex = content.indexOf(marker);
      if (markerIndex === -1) continue;
      const startIdx = markerIndex + marker.length;
      let endIdx = content.length;
      for (const nextMarker of Object.values(MARKERS).flat()) {
        const nextIdx = content.indexOf(nextMarker, startIdx);
        if (nextIdx !== -1 && nextIdx < endIdx) endIdx = nextIdx;
      }
      stepContent = content.slice(startIdx, endIdx).trim();
      break;
    }
    if (stepContent) {
      steps.push({
        step: stepType,
        title: STEP_TITLES[stepType],
        content: stepContent,
        duration: Math.floor(totalDuration / STEP_TYPES.length),
      });
    }
  }

  return {
    id: uuidv4(),
    agentRole,
    timestamp: endTime,
    steps,
    summary: summarizeChainOfThought(steps),
  };
}

export function summarizeChainOfThought(steps: CoTStep[]): string {
  if (steps.length === 0) return '无结构化思维标记';
  return steps.map((s) => `${s.title}: ${s.content.slice(0, 40)}`).join(' / ');
}
