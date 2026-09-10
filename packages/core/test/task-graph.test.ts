import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskGraphError, validateTaskGraph, getReadyTasks, type TaskGraph } from '../src/task-graph.js';
const task = (id: string, dependencies: string[] = []): any => ({ id, objectiveId: 'o1', title: id, description: id, status: 'PENDING', dependencies, riskLevel: 'GREEN', actualCost: 0, retryCount: 0, retryLimit: 3, metadata: {} });
test('valid dependency is accepted and dependent is not ready until completion', () => { const graph: TaskGraph = { tasks: [task('a'), task('b', ['a'])] }; validateTaskGraph(graph); assert.deepEqual(getReadyTasks(graph).map((x) => x.id), ['a']); });
test('missing dependency is rejected', () => assert.throws(() => validateTaskGraph({ tasks: [task('a', ['missing'])] }), TaskGraphError));
test('self dependency is rejected', () => assert.throws(() => validateTaskGraph({ tasks: [task('a', ['a'])] }), TaskGraphError));
test('duplicate dependency is rejected', () => assert.throws(() => validateTaskGraph({ tasks: [task('a'), task('b', ['a', 'a'])] }), TaskGraphError));
test('cycle is rejected', () => assert.throws(() => validateTaskGraph({ tasks: [task('a', ['b']), task('b', ['a'])] }), TaskGraphError));
