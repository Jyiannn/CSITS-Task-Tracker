<?php
declare(strict_types=1);

/**
 * JSON API for the CSITS Task Tracker.
 *
 *   GET    api.php?status=&search=&sort=   list tasks + counts
 *   POST   api.php                        create a task
 *   PUT    api.php?id=tsk_xxx             update a task
 *   PATCH  api.php?id=tsk_xxx             update only the status
 *   DELETE api.php?id=tsk_xxx             delete a task
 */

require __DIR__ . '/lib/store.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400, array $errors = []): never
{
    $payload = ['error' => $message];
    if ($errors !== []) {
        $payload['errors'] = $errors;
    }

    respond($payload, $status);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        if ($_POST !== []) {
            return $_POST;
        }
        fail('A request body is required.', 400);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        fail('The request body must be a valid JSON object.', 400);
    }

    return $decoded;
}

function now_iso(): string
{
    return (new DateTimeImmutable())->format(DATE_ATOM);
}

try {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($method === 'POST' && isset($_GET['_method'])) {
        $method = strtoupper((string) $_GET['_method']);
    }

    $taskId = trim((string) ($_GET['id'] ?? ''));

    switch ($method) {
        case 'GET':
            $status = isset($_GET['status']) ? trim((string) $_GET['status']) : 'all';
            $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
            $sort = isset($_GET['sort']) ? trim((string) $_GET['sort']) : 'due';

            if ($status !== 'all' && !isset(STATUS_LABELS[$status])) {
                fail('Unknown status filter.', 422, ['status' => 'Choose a valid status filter.']);
            }
            if (!in_array($sort, ['due', 'priority', 'created', 'title'], true)) {
                $sort = 'due';
            }
            if (mb_strlen($search) > 100) {
                $search = mb_substr($search, 0, 100);
            }

            $allTasks = read_tasks();
            $tasks = $allTasks;

            if ($status !== 'all') {
                $tasks = array_values(array_filter(
                    $tasks,
                    static fn (array $task): bool => $task['status'] === $status
                ));
            }

            if ($search !== '') {
                $needle = mb_strtolower($search, 'UTF-8');
                $tasks = array_values(array_filter(
                    $tasks,
                    static function (array $task) use ($needle): bool {
                        $haystack = mb_strtolower(
                            implode(' ', [$task['title'], $task['description'], $task['assignee']]),
                            'UTF-8'
                        );

                        return mb_strpos($haystack, $needle) !== false;
                    }
                ));
            }

            usort($tasks, static function (array $a, array $b) use ($sort): int {
                return match ($sort) {
                    'created' => strcmp($b['created_at'], $a['created_at']),
                    'title' => strcasecmp($a['title'], $b['title']),
                    'priority' => priority_rank($b) <=> priority_rank($a)
                        ?: strcmp($a['due_date'], $b['due_date']),
                    default => ($a['status'] === 'completed') <=> ($b['status'] === 'completed')
                        ?: strcmp($a['due_date'], $b['due_date'])
                        ?: priority_rank($b) <=> priority_rank($a),
                };
            });

            respond([
                'tasks' => array_values($tasks),
                'counts' => summarize_tasks($allTasks),
                'filters' => ['status' => $status, 'search' => $search, 'sort' => $sort],
            ]);

        case 'POST':
            $payload = read_json_body();
            [$clean, $errors] = validate_task($payload, false);
            if ($errors !== []) {
                fail('Please fix the highlighted fields.', 422, $errors);
            }

            $now = now_iso();
            $task = [
                'id' => 'tsk_' . bin2hex(random_bytes(6)),
                'title' => $clean['title'],
                'description' => $clean['description'],
                'assignee' => $clean['assignee'],
                'due_date' => $clean['due_date'],
                'priority' => $clean['priority'],
                'status' => $clean['status'],
                'created_at' => $now,
                'updated_at' => $now,
            ];

            mutate_tasks(static function (array &$tasks) use ($task): void {
                $tasks[] = $task;
            });

            respond(['task' => $task, 'message' => 'Task created.'], 201);

        case 'PUT':
            if ($taskId === '') {
                fail('Task id is required.', 400);
            }

            $payload = read_json_body();
            [$clean, $errors] = validate_task($payload, true);
            if ($errors !== []) {
                fail('Please fix the highlighted fields.', 422, $errors);
            }

            $updated = mutate_tasks(static function (array &$tasks) use ($taskId, $clean): ?array {
                $index = find_task_index($tasks, $taskId);
                if ($index < 0) {
                    return null;
                }

                $tasks[$index] = array_merge($tasks[$index], $clean, [
                    'updated_at' => now_iso(),
                ]);

                return $tasks[$index];
            });

            if ($updated === null) {
                fail('Task not found.', 404);
            }

            respond(['task' => $updated, 'message' => 'Task updated.']);

        case 'PATCH':
            if ($taskId === '') {
                fail('Task id is required.', 400);
            }

            $payload = read_json_body();
            $status = is_string($payload['status'] ?? null)
                ? strtolower(trim($payload['status']))
                : '';

            if (!isset(STATUS_LABELS[$status])) {
                fail('Choose a valid status.', 422, ['status' => 'Choose a valid status.']);
            }

            $updated = mutate_tasks(static function (array &$tasks) use ($taskId, $status): ?array {
                $index = find_task_index($tasks, $taskId);
                if ($index < 0) {
                    return null;
                }

                $tasks[$index]['status'] = $status;
                $tasks[$index]['updated_at'] = now_iso();

                return $tasks[$index];
            });

            if ($updated === null) {
                fail('Task not found.', 404);
            }

            respond([
                'task' => $updated,
                'message' => 'Status updated to ' . STATUS_LABELS[$status] . '.',
            ]);

        case 'DELETE':
            if ($taskId === '') {
                fail('Task id is required.', 400);
            }

            $deleted = mutate_tasks(static function (array &$tasks) use ($taskId): ?array {
                $index = find_task_index($tasks, $taskId);
                if ($index < 0) {
                    return null;
                }

                $removed = $tasks[$index];
                array_splice($tasks, $index, 1);

                return $removed;
            });

            if ($deleted === null) {
                fail('Task not found.', 404);
            }

            respond(['task' => $deleted, 'message' => 'Task deleted.']);

        default:
            header('Allow: GET, POST, PUT, PATCH, DELETE');
            fail('Method not allowed.', 405);
    }
} catch (Throwable $exception) {
    error_log('[task-tracker] ' . $exception->getMessage());
    fail('Something went wrong on the server.', 500);
}
