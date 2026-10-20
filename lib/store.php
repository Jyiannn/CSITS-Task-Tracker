<?php
declare(strict_types=1);

/**
 * Task store + validation helpers.
 *
 * Tasks live in data/tasks.json, so the app needs no database.
 * Every write goes through mutate_tasks(), which serialises access with a lock file.
 */

date_default_timezone_set(getenv('APP_TIMEZONE') ?: 'Asia/Manila');

const STATUS_LABELS = [
    'todo' => 'To Do',
    'in_progress' => 'In Progress',
    'completed' => 'Completed',
];

const PRIORITY_LABELS = [
    'low' => 'Low',
    'medium' => 'Medium',
    'high' => 'High',
];

const PRIORITY_RANK = ['low' => 1, 'medium' => 2, 'high' => 3];

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const ASSIGNEE_MIN = 2;
const ASSIGNEE_NAME_MAX = 60;
const ASSIGNEE_MAX = 200;
const DESCRIPTION_MAX = 700;

function data_dir(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
}

function tasks_file(): string
{
    return data_dir() . DIRECTORY_SEPARATOR . 'tasks.json';
}

/** Create the data directory and seed a few demo tasks on first run. */
function ensure_store(): void
{
    $dir = data_dir();
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    if (!is_dir($dir)) {
        throw new RuntimeException('Unable to create the data directory: ' . $dir);
    }

    $file = tasks_file();
    if (is_file($file)) {
        return;
    }

    // "x" fails when another request already created the file.
    $handle = @fopen($file, 'x');
    if ($handle === false) {
        return;
    }

    try {
        fwrite($handle, encode_tasks(seed_tasks()));
    } finally {
        fclose($handle);
    }
}

function seed_tasks(): array
{
    $today = new DateTimeImmutable('today');
    $stamp = (new DateTimeImmutable())->format(DATE_ATOM);

    $make = static function (
        string $title,
        string $description,
        string $assignee,
        string $dueDate,
        string $priority,
        string $status
    ) use ($stamp): array {
        return [
            'id' => 'tsk_' . bin2hex(random_bytes(6)),
            'title' => $title,
            'description' => $description,
            'assignee' => $assignee,
            'due_date' => $dueDate,
            'priority' => $priority,
            'status' => $status,
            'created_at' => $stamp,
            'updated_at' => $stamp,
        ];
    };

    return [
        $make(
            'Finalize general assembly deck',
            'Consolidate officer reports and rehearsal notes before the dry run.',
            'Mika Reyes',
            $today->modify('+3 days')->format('Y-m-d'),
            'high',
            'in_progress'
        ),
        $make(
            'Submit org budget proposal',
            'Attach the projected expenses and get the adviser\'s signature.',
            'Jeanne Cruz',
            $today->modify('-2 days')->format('Y-m-d'),
            'high',
            'todo'
        ),
        $make(
            'Design recruitment poster',
            'Prepare the main copy and two square variants for social media.',
            'Ari Santos',
            $today->modify('+6 days')->format('Y-m-d'),
            'medium',
            'todo'
        ),
        $make(
            'Reserve AV equipment for tech talk',
            'Coordinate with the facilities office for projector and microphones.',
            'Kyle Dizon',
            $today->format('Y-m-d'),
            'medium',
            'in_progress'
        ),
        $make(
            'Archive last semester\'s minutes',
            'Upload the signed minutes to the shared org drive.',
            'Mika Reyes',
            $today->modify('-6 days')->format('Y-m-d'),
            'low',
            'completed'
        ),
    ];
}

function encode_tasks(array $tasks): string
{
    $json = json_encode(
        array_values($tasks),
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    if ($json === false) {
        throw new RuntimeException('Unable to encode task data.');
    }

    return $json . PHP_EOL;
}

function normalize_task(array $task): array
{
    return [
        'id' => (string) ($task['id'] ?? ''),
        'title' => (string) ($task['title'] ?? 'Untitled task'),
        'description' => (string) ($task['description'] ?? ''),
        'assignee' => (string) ($task['assignee'] ?? 'Unassigned'),
        'due_date' => (string) ($task['due_date'] ?? ''),
        'priority' => isset(PRIORITY_LABELS[$task['priority'] ?? '']) ? $task['priority'] : 'medium',
        'status' => isset(STATUS_LABELS[$task['status'] ?? '']) ? $task['status'] : 'todo',
        'created_at' => (string) ($task['created_at'] ?? ''),
        'updated_at' => (string) ($task['updated_at'] ?? ''),
    ];
}

function read_tasks(): array
{
    ensure_store();

    $raw = @file_get_contents(tasks_file());
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Task data is not valid JSON. Check data/tasks.json.');
    }

    $tasks = [];
    foreach ($decoded as $task) {
        if (!is_array($task)) {
            continue;
        }
        $task = normalize_task($task);
        if ($task['id'] !== '') {
            $tasks[] = $task;
        }
    }

    return $tasks;
}

function save_tasks(array $tasks): void
{
    $file = tasks_file();
    $dir = dirname($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    if (!is_dir($dir)) {
        throw new RuntimeException('Unable to create the data directory.');
    }

    $json = encode_tasks($tasks);
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';

    if (file_put_contents($tmp, $json, LOCK_EX) === false) {
        throw new RuntimeException('Unable to write task data.');
    }

    // Prefer an atomic replace; fall back to a direct write on platforms where rename fails.
    if (!@rename($tmp, $file)) {
        if (file_put_contents($file, $json, LOCK_EX) === false) {
            @unlink($tmp);
            throw new RuntimeException('Unable to write task data.');
        }
        @unlink($tmp);
    }

    @chmod($file, 0664);
}

/**
 * Apply a read-modify-write operation under an exclusive lock.
 *
 * @param callable(array &$tasks): mixed $mutator
 */
function mutate_tasks(callable $mutator): mixed
{
    ensure_store();

    $lockPath = data_dir() . DIRECTORY_SEPARATOR . '.lock';
    $lock = @fopen($lockPath, 'c');
    if ($lock === false) {
        throw new RuntimeException('Unable to open the task store lock.');
    }
    if (!flock($lock, LOCK_EX)) {
        fclose($lock);
        throw new RuntimeException('Unable to lock the task store.');
    }

    try {
        $tasks = read_tasks();
        $result = $mutator($tasks);
        save_tasks($tasks);

        return $result;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function normalize_line(mixed $value): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = strip_tags($value);
    $value = preg_replace('/\s+/u', ' ', $value);

    return trim($value ?? '');
}

function normalize_multiline(mixed $value): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = strip_tags($value);
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace("/\n{3,}/", "\n\n", $value);

    return trim($value ?? '');
}

/**
 * Validate and normalise a task payload.
 *
 * @return array{0: array<string, string>, 1: array<string, string>} [clean values, errors]
 */
function validate_task(array $input, bool $isUpdate = false): array
{
    $errors = [];

    $title = normalize_line($input['title'] ?? '');
    if ($title === '') {
        $errors['title'] = 'Task title is required.';
    } elseif (mb_strlen($title) < TITLE_MIN) {
        $errors['title'] = 'Use at least ' . TITLE_MIN . ' characters.';
    } elseif (mb_strlen($title) > TITLE_MAX) {
        $errors['title'] = 'Keep the title under ' . TITLE_MAX . ' characters.';
    }

    $description = normalize_multiline($input['description'] ?? '');
    if (mb_strlen($description) > DESCRIPTION_MAX) {
        $errors['description'] = 'Keep the description under ' . DESCRIPTION_MAX . ' characters.';
    }

    $assigneeRaw = normalize_line($input['assignee'] ?? '');
    $assigneeNames = [];
    foreach (explode(',', $assigneeRaw) as $part) {
        $name = normalize_line($part);
        if ($name !== '') {
            $assigneeNames[] = $name;
        }
    }
    $assignee = implode(', ', $assigneeNames);

    if ($assignee === '') {
        $errors['assignee'] = 'Assign this task to at least one person.';
    } elseif (mb_strlen($assignee) > ASSIGNEE_MAX) {
        $errors['assignee'] = 'Keep the assignee list under ' . ASSIGNEE_MAX . ' characters.';
    } else {
        foreach ($assigneeNames as $name) {
            if (mb_strlen($name) < ASSIGNEE_MIN) {
                $errors['assignee'] = 'Each name needs at least ' . ASSIGNEE_MIN . ' characters.';
                break;
            }

            if (mb_strlen($name) > ASSIGNEE_NAME_MAX) {
                $errors['assignee'] = 'Keep each name under ' . ASSIGNEE_NAME_MAX . ' characters.';
                break;
            }

            if (!preg_match("/^[\p{L}][\p{L}\p{M}\s.'\-]*$/u", $name)) {
                $errors['assignee'] = 'Use letters, spaces, apostrophes, hyphens, or periods for each name.';
                break;
            }
        }
    }

    $dueDate = is_string($input['due_date'] ?? null) ? trim($input['due_date']) : '';
    if ($dueDate === '') {
        $errors['due_date'] = 'Set a due date.';
    } else {
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $dueDate);
        if ($parsed === false || $parsed->format('Y-m-d') !== $dueDate) {
            $errors['due_date'] = 'Enter a valid date (YYYY-MM-DD).';
        } elseif (!$isUpdate && $parsed < new DateTimeImmutable('today')) {
            $errors['due_date'] = 'Due date cannot be in the past.';
        }
    }

    $priority = is_string($input['priority'] ?? null)
        ? strtolower(trim($input['priority']))
        : 'medium';
    if (!isset(PRIORITY_LABELS[$priority])) {
        $errors['priority'] = 'Choose a valid priority.';
        $priority = 'medium';
    }

    $status = is_string($input['status'] ?? null)
        ? strtolower(trim($input['status']))
        : 'todo';
    if (!isset(STATUS_LABELS[$status])) {
        $errors['status'] = 'Choose a valid status.';
        $status = 'todo';
    }

    return [[
        'title' => $title,
        'description' => $description,
        'assignee' => $assignee,
        'due_date' => $dueDate,
        'priority' => $priority,
        'status' => $status,
    ], $errors];
}

function find_task_index(array $tasks, string $id): int
{
    foreach ($tasks as $index => $task) {
        if (($task['id'] ?? '') === $id) {
            return (int) $index;
        }
    }

    return -1;
}

function summarize_tasks(array $tasks): array
{
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    $counts = [
        'total' => count($tasks),
        'todo' => 0,
        'in_progress' => 0,
        'completed' => 0,
        'overdue' => 0,
    ];

    foreach ($tasks as $task) {
        $status = $task['status'] ?? 'todo';
        if (isset($counts[$status])) {
            $counts[$status]++;
        }

        $due = $task['due_date'] ?? '';
        if ($status !== 'completed' && $due !== '' && $due < $today) {
            $counts['overdue']++;
        }
    }

    return $counts;
}

function priority_rank(array $task): int
{
    return PRIORITY_RANK[$task['priority'] ?? ''] ?? 0;
}
