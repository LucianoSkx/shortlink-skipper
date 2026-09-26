/**
 * Gulpfile for ShortlinkSkipper
 *
 * This file orchestrates all the build tasks for the project.
 * It imports task creators from the build directory and initializes them.
 */

// Import task creators
import { createUserscriptTasks } from "./build/tasks/userscript.js";
import { clean } from "./build/tasks/clean.js";

// Initialize all task collections
const userscriptTasks = createUserscriptTasks();

// Export tasks with descriptive names for Gulp 5
export {
  // Cleanup task
  clean,

  // Main build tasks (default export)
  userscriptTasks as default,
  userscriptTasks as userscript,
};
