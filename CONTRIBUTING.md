# Contributing to FireForm Frontend

Thanks for taking the time to help out. FireForm exists to cut the paperwork load on firefighters and other emergency crews, and the desktop app is the part responders actually touch so every fix here lands in front of real users.

This repository holds the Electron desktop client only. The API, the local speech-to-text service, and the LLM pieces live in the main [FireForm](https://github.com/fireform-core/FireForm) repo and run separately.

## Ways to Contribute

### Filing a bug

Search the [open issues](https://github.com/fireform-core/fireform-frontend/issues) first chances are someone's already hit it. If not, open one and tell us:

- What you did, step by step, so we can reproduce it.
- What you expected versus what actually happened.
- Your OS and how you launched the app (`npm start` vs. a packaged build).
- A screenshot or the DevTools console output, if there's an error.

Since the app talks to a separate backend, mention whether the API was running and how you started it. A UI bug and a "backend wasn't up" bug look identical from the window.

### Suggesting a change

Open an issue describing the idea, what problem it solves for someone on a callout, and roughly how you picture it working. UI mockups or a sketch help more than paragraphs.

### Pull requests

1. Fork the repo and branch off `main`.
2. Keep the change focused one fix or feature per PR is far easier to review.
3. Run the app and click through the flow you touched before pushing (see below).
4. Write a PR description that says what changed and why, and link the issue it closes.

## Getting the Code

Work off your own fork and open PRs back to the main repo.

1. Fork [fireform-core/fireform-frontend](https://github.com/fireform-core/fireform-frontend) using the **Fork** button on GitHub.
2. Clone your fork and step into it:

   ```bash
   git clone https://github.com/<your-username>/fireform-frontend.git
   cd fireform-frontend
   ```

3. Point `upstream` at the original so you can pull in updates later:

   ```bash
   git remote add upstream https://github.com/fireform-core/fireform-frontend.git
   ```

4. Start your work on a fresh branch off `main`:

   ```bash
   git checkout -b your-branch-name
   ```

5. Before a long-lived branch drifts, sync with upstream:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

When you're done, push to your fork (`git push origin your-branch-name`) and open a PR against `fireform-core/fireform-frontend`'s `main`.

The backend lives in a separate repo [fireform-core/FireForm](https://github.com/fireform-core/FireForm) which you'll clone too if you need the API running locally (see Local Setup).

In development the app does **not** spawn a backend it assumes one is already running. Start the API and the local services from the main FireForm repo (the `make fireform` target there brings up Docker). Without it the window loads, but anything that calls the API will fail.

## Style

Match what's already there. The codebase is small and unopinionated; consistent beats clever. Keep comments to the bits that aren't obvious from the code, and leave the file tidier than you found it.
