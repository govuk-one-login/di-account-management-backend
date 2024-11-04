# Utility Scripts for Backend Repository

This directory contains utility scripts to support repository maintenance and development tasks. The main script here, `onboard-rp.py`, is designed to automate the update of translation files across environments in both frontend and backend repositories.

## Scripts

### update_translations.py

This script simplifies the process of updating translation files for multiple environments and automatically commits and pushes these updates to new branches. It’s designed to be run locally and interacts with both frontend and backend repositories.

#### Features

- Adds or updates translation keys for each environment.
- Allows for English and Welsh translations.
- Creates a new branch, commits changes, and pushes to origin.
- Works across environments like `local`, `dev`, `staging`, `production`, and more.

#### Prerequisites

1. **Python**: Ensure Python 3.6+ is installed.
2. **Git Access**: You need access to both the frontend and backend repositories to push changes.
3. **File Paths**: Verify that the translation file paths are correct and accessible from your machine. If paths change, update `FRONTEND_TRANSLATION_FILES` and `BACKEND_TRANSLATION_FILES` in the script.

#### Setup

1. This script currently doesn’t require external libraries.

2. File Paths: Update the paths in the script if needed:

- FRONTEND_TRANSLATION_FILES: List of translation file paths in the frontend repository.
- BACKEND_TRANSLATION_FILES: List of translation file paths in the backend repository.

#### Setup

1. **No External Libraries Needed**: This script currently doesn’t require any external libraries.

2. **File Paths**: Update the paths in the script if needed:

   - **`FRONTEND_TRANSLATION_FILES`**: List of translation file paths in the frontend repository.
   - **`BACKEND_TRANSLATION_FILES`**: List of translation file paths in the backend repository.

3. **How to Run the Script**

   - **Run the Script**: From the backend repository root directory, use this command:

     ```bash
     python scripts/onboard-rp.py
     ```

   - **Follow the Prompts**:

     - **Branch Name**: Enter the name of the new branch where the updates will be committed.
     - **Production and Non-Production IDs**: Specify unique IDs for translation keys in production and non-production environments.
     - **Translation Details**: You’ll be prompted to enter English and Welsh translations for:
       - Header text
       - Description text
       - Link text
       - Link href (URL)

   - **Verify Output**: After completion, check both the frontend and backend repositories to confirm that:
     - Translation files were updated as expected.
     - Changes are committed to a new branch in each repository.
     - New branches were successfully pushed to origin.
