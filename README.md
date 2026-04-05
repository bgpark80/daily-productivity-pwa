# Daily Focus PWA

Daily Focus is a simple React Progressive Web App for managing everyday tasks. It lets you sort tasks into **Want to do** and **Must do**, mark them as complete, edit them, delete them, and keep everything saved in local storage.

## Features

- Add, edit, delete, and complete tasks
- Separate tasks into `Want to do` and `Must do`
- View completed tasks in a separate section
- Save tasks in browser local storage
- Responsive mobile-friendly layout
- PWA support with `manifest.json` and `service worker`
- Basic offline support after the app is loaded once

## Project Structure

```text
daily-productivity-pwa/
├─ public/
│  ├─ icons/
│  │  ├─ icon-192.png
│  │  ├─ icon-512.png
│  │  └─ icon-maskable-512.png
│  ├─ manifest.json
│  ├─ offline.html
│  └─ sw.js
├─ src/
│  ├─ components/
│  │  ├─ TaskForm.jsx
│  │  ├─ TaskItem.jsx
│  │  └─ TaskSection.jsx
│  ├─ hooks/
│  │  └─ useLocalStorage.js
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ styles.css
├─ index.html
├─ package.json
└─ vite.config.js
```

## What Each Folder Does

- `src/` contains the React app code.
- `src/components/` holds small reusable UI components.
- `src/hooks/` contains the custom local storage hook.
- `public/` contains PWA files that are copied as-is when the app is built.

## How to Run Locally

1. Install **Node.js 18+** and **npm**.
2. Open a terminal in `daily-productivity-pwa`.
3. Install packages:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL shown in the terminal.

## How to Test the PWA Features

Service workers are best tested in the production preview:

```bash
npm run build
npm run preview
```

Then open the preview URL in your browser and:

- check that the app can be installed
- refresh the page after adding tasks
- test offline mode after loading the app once

## Notes

- Tasks are stored in the browser using local storage.
- If you clear browser storage, your tasks will be removed.
- The app UI is written in English.
