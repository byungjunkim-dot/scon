import { addDays, parseISO, format, differenceInDays, isValid } from 'date-fns';
import { ScheduleItem } from '../types';

/**
 * Calculate the linked start date based on predecessor's end date and lag days.
 * Default lag is 1 day (starts the next day after predecessor finishes).
 */
export function calculateLinkedStartDate(predecessorEndDate: string, lagDays: number = 1): string {
  try {
    const end = parseISO(predecessorEndDate);
    if (!isValid(end)) return predecessorEndDate;
    const nextStart = addDays(end, lagDays);
    return format(nextStart, 'yyyy-MM-dd');
  } catch (e) {
    return predecessorEndDate;
  }
}

/**
 * Calculate end date keeping duration consistent.
 */
export function calculateLinkedEndDate(startDate: string, duration: number): string {
  try {
    const start = parseISO(startDate);
    if (!isValid(start)) return startDate;
    const dur = Math.max(1, duration);
    const end = addDays(start, dur - 1);
    return format(end, 'yyyy-MM-dd');
  } catch (e) {
    return startDate;
  }
}

/**
 * Returns a list of all downstream tasks that depend on the given item (directly or indirectly).
 * Used to cascade date updates to all subsequent tasks in the chain.
 */
export function getCascadeUpdates(
  changedItem: ScheduleItem,
  allItems: ScheduleItem[],
  lagDays: number = 1
): ScheduleItem[] {
  const updates: ScheduleItem[] = [];
  const visited = new Set<string>([changedItem.id]);

  function cascade(currentItem: ScheduleItem) {
    // Find all items that have currentItem as predecessor
    const directChildren = allItems.filter(
      item => item.predecessor === currentItem.id && !visited.has(item.id)
    );

    for (const child of directChildren) {
      visited.add(child.id);

      const newStartDate = calculateLinkedStartDate(currentItem.endDate, lagDays);
      const childDuration = Math.max(
        1,
        child.duration || differenceInDays(parseISO(child.endDate), parseISO(child.startDate)) + 1 || 1
      );
      const newEndDate = calculateLinkedEndDate(newStartDate, childDuration);

      const updatedChild: ScheduleItem = {
        ...child,
        startDate: newStartDate,
        endDate: newEndDate,
        duration: childDuration
      };

      updates.push(updatedChild);
      // Recursively cascade downstream
      cascade(updatedChild);
    }
  }

  cascade(changedItem);
  return updates;
}

/**
 * Sequentially link all items or re-cascade all predecessor-based items.
 * If items have predecessors, follows predecessors.
 * If sequentialMode is true, links each item to the preceding item in order.
 */
export function autoLinkSchedules(
  items: ScheduleItem[],
  options: { sequentialMode?: boolean; lagDays?: number } = {}
): ScheduleItem[] {
  const { sequentialMode = false, lagDays = 1 } = options;
  if (!items || items.length === 0) return [];

  const updatedList: ScheduleItem[] = items.map(i => ({ ...i }));
  const itemMap = new Map<string, ScheduleItem>();
  updatedList.forEach(item => itemMap.set(item.id, item));

  if (sequentialMode) {
    // Sequentially link: item[i] follows item[i-1]
    for (let i = 1; i < updatedList.length; i++) {
      const prev = updatedList[i - 1];
      const curr = updatedList[i];
      const newStart = calculateLinkedStartDate(prev.endDate, lagDays);
      const duration = Math.max(
        1,
        curr.duration || differenceInDays(parseISO(curr.endDate), parseISO(curr.startDate)) + 1 || 1
      );
      const newEnd = calculateLinkedEndDate(newStart, duration);

      curr.predecessor = prev.id;
      curr.startDate = newStart;
      curr.endDate = newEnd;
      curr.duration = duration;
    }
    return updatedList;
  }

  // Predecessor-based topological cascade
  const idSet = new Set(updatedList.map(i => i.id));
  const queue: ScheduleItem[] = updatedList.filter(
    item => !item.predecessor || !idSet.has(item.predecessor)
  );

  const processed = new Set<string>();
  queue.forEach(q => processed.add(q.id));

  let safetyCount = 0;
  const maxIterations = updatedList.length * 3;

  while (queue.length > 0 && safetyCount < maxIterations) {
    safetyCount++;
    const current = queue.shift()!;
    
    // Find all items that have current as predecessor
    const children = updatedList.filter(item => item.predecessor === current.id);
    for (const child of children) {
      const newStart = calculateLinkedStartDate(current.endDate, lagDays);
      const duration = Math.max(
        1,
        child.duration || differenceInDays(parseISO(child.endDate), parseISO(child.startDate)) + 1 || 1
      );
      const newEnd = calculateLinkedEndDate(newStart, duration);

      child.startDate = newStart;
      child.endDate = newEnd;
      child.duration = duration;

      queue.push(child);
      processed.add(child.id);
    }
  }

  return updatedList;
}
