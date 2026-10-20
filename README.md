# CSITS Task Tracker

## Description

CSITS Task Tracker is a lightweight web-based task tracker for the CSITS Organization, built with PHP, HTML, CSS, and JavaScript. It provides a card-based board and a dynamic month calendar for creating, assigning, editing, and monitoring tasks.

Tasks can have multiple assignees, due dates, priorities, descriptions, and statuses. The app also supports status filtering, search, and sorting. All task data is stored in a JSON file, so no database, Composer packages, or build tools are required.

Important Note: AI Assisted.

## File structure

```text
.
├── index.php              # Page shell, board/calendar markup, task dialogs
├── api.php                # JSON CRUD API
├── lib/
│   └── store.php          # JSON storage, locking, validation, summary counts
├── assets/
│   ├── app.js             # API calls, rendering, filters, calendar, form validation
│   └── style.css          # Layout, components, responsive rules, dark mode
├── data/
│   ├── .htaccess          # Blocks direct Apache access to task data
│   ├── tasks.json         # Runtime task data (created automatically; gitignored)
│   └── .lock              # Runtime write lock (created automatically; gitignored)
├── .gitignore             # Ignores runtime data and editor/OS files
└── README.md
```

## Requirements

- **PHP 8.1 or newer** (built and tested with PHP 8.2).
- PHP extensions: **`json`** and **`mbstring`** (enabled by default in most PHP installations).
- A modern web browser with JavaScript and `<dialog>` support (current Chrome, Edge, Firefox, or Safari).
- Write access to the `data/` directory.
- **No** database, Composer, Node.js, npm, or build step.

You can run the app with PHP's built-in server or with Apache/Nginx + PHP-FPM. XAMPP works out of the box.

## Setup and run

### Option 1: PHP built-in server

1. Open a terminal in the project folder.
2. Confirm that PHP is available:

   ```bash
   php -v
   ```

3. Start the development server:

   ```bash
   php -S localhost:8000
   ```

4. Open <http://localhost:8000> in your browser.

To stop the server, press `Ctrl+C` in the terminal.

> The built-in server is intended for local development. It does not process `.htaccess` files.

### Option 2: XAMPP / Apache

1. Copy the project folder into your XAMPP web root, for example:

   ```text
   C:\xampp\htdocs\BAI-B KOD
   ```

2. Open the XAMPP Control Panel and start **Apache**. MySQL is not required.
3. Visit the app:

   ```text
   http://localhost/BAI-B%20KOD/
   ```

   The `%20` represents the space in the folder name. If you rename the folder, use that folder name in the URL instead.

### First run

- If `data/tasks.json` does not exist, the app creates it automatically and seeds five sample tasks.
- If the file already exists, its contents are used as-is. An existing empty file (`[]`) means the board starts empty.
- Make sure PHP can write to the `data/` directory.
