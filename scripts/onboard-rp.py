import os
import json
import subprocess
import re
from pathlib import Path

# --- Constants ---
FRONTEND_REPO_PATH = Path("../di-account-management-frontend")
BACKEND_REPO_PATH = Path("../di-account-management-backend")

FRONTEND_TRANSLATION_FILES = [
    FRONTEND_REPO_PATH / "src/locales/en/translation.json",
    FRONTEND_REPO_PATH / "src/locales/cy/translation.json",
]
BACKEND_TRANSLATION_FILES = [
    BACKEND_REPO_PATH / "src/config/clientRegistry.cy.json",
    BACKEND_REPO_PATH / "src/config/clientRegistry.en.json",
]

FRONTEND_ENVIRONMENTS = ["local", "dev", "build", "staging", "integration", "production"]

# --- Helper Functions ---
def run_command(command):
    print(command)
    """Runs a shell command and raises an exception if it fails."""
    process = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.returncode != 0:
        raise Exception(f"Command failed: {command}\nError: {process.stderr.decode().strip()}")
    return process.stdout.decode().strip()

def update_json_file(file_path, environments, new_objects, production_id, non_production_id, key=None):
    """Updates a JSON file with new translation objects for each environment."""
    with open(file_path, 'r+') as file:
        data = json.load(file)
        root_data = data.setdefault(key, data) if key else data
        for env in environments:
            target_id = production_id if env in ("production", "integration") else non_production_id
            root_data.setdefault(env, {})[target_id] = {
                **root_data[env].get(target_id, {}),
                **new_objects
            }
        file.seek(0)
        json.dump(data, file, indent=2, ensure_ascii=False)
        file.truncate()

def update_config_ts(file_path, production_id, non_production_id, rp_const_name):
    """Updates the config.ts file with new RP constants and updates the allowed client IDs."""
    with open(file_path, 'r+') as file:
        config_content = file.read()

        # Define new constants
        prod_const_name = f'{rp_const_name}_PROD'
        non_prod_const_name = f'{rp_const_name}_NON_PROD'
        prod_const = f'const {prod_const_name} = "{production_id}";'
        non_prod_const = f'const {non_prod_const_name} = "{non_production_id}";'

        # Find the end of the constant declarations block
        end_of_block = config_content.rfind(';', 0, config_content.find('export const getAllowedAccountListClientIDs'))

        # Insert new constants after the found end of block
        config_content = (
            config_content[:end_of_block + 1] +
            f'\n{prod_const}\n{non_prod_const}' +
            config_content[end_of_block + 1:]
        )

        # Update getAllowedAccountListClientIDs array
        array_pattern = r'export const getAllowedAccountListClientIDs: string\[] = \[([^\]]*)\];'
        match = re.search(array_pattern, config_content)
        if match:
            # Get the existing array content and strip whitespace
            array_content = [item.strip() for item in match.group(1).split(',')]

            array_content.append(prod_const_name)
            array_content.append(non_prod_const_name)

            # Reformat the array without duplicates and maintain single commas
            new_array_content = ', '.join(filter(None, array_content)).replace(', ,', ',').strip(', ')

            # Replace the array with updated content
            config_content = re.sub(array_pattern, f'export const getAllowedAccountListClientIDs: string[] = [{new_array_content}];', config_content)
        else: 
            print("Could not find AllowedAccountListClientIDs")
        # Write back to file
        file.seek(0)
        file.write(config_content)
        file.truncate()

    run_prettier(file_path)


def run_prettier(file_path):
    """Formats a file using Prettier."""
    command = f'npx prettier --write {file_path}'
    process = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.returncode != 0:
        raise Exception(f"Prettier formatting failed: {process.stderr.decode().strip()}")

def setup_repo(repo_path, branch_name):
    """Fetches the latest changes from the main branch and creates a new branch."""
    os.chdir(repo_path)
    run_command('git fetch origin main')
    run_command('git checkout main')
    run_command('git pull origin main')
    run_command(f'git checkout -b {branch_name}')

def commit_and_push_changes(repo_path, rp_const_name):
    """Commits and pushes the changes to the remote repository."""
    os.chdir(repo_path)
    # Uncomment the lines below when you are ready to push to the remote repository
    # run_command('git add .')
    # run_command(f'git commit -m "Onboarded RP {rp_const_name}"')
    # run_command(f'git push origin {branch_name}')

# --- Main Function ---
def main():
    """Collects user input and updates the frontend and backend repositories."""
    account_bool = input("Onboarding Account(1) or Service(2): ")
    if account_bool == "2":
        print("Onboarding Service currently not supported.")
        return

    branch_name = input("Enter the new branch name: ")
    # setup_repo(FRONTEND_REPO_PATH, branch_name)
    # setup_repo(BACKEND_REPO_PATH, branch_name)
    production_id = input("Enter the production environment ID: ")
    non_production_id = input("Enter the non-production environment ID (e.g., dfeQualifiedTeacherStatus): ")
    rp_const_name = input("Enter the name for the RP constant (e.g., DFE_TEACHER_VACANCIES): ").upper()

    print("Enter English translations:")
    link_href = input("Link Href (signed in state): ")
    en_translation_object = {
        "header": input("Service Name (English): "),
        "description": input("Description (English): ").rstrip(".") + ".",
        "link_text": input("Link Text (English): "),
        "link_href": link_href
    }

    print("Enter Welsh translations:")
    cy_translation_object = {
        "header": input("Service Name (Welsh): "),
        "description": input("Description (Welsh): ").rstrip(".") + ".",
        "link_text": input("Link Text (Welsh): "),
        "link_href": link_href
    }

    # Update Frontend Repo
    os.chdir(FRONTEND_REPO_PATH)
    for translation_file in FRONTEND_TRANSLATION_FILES:
        if translation_file.exists():
            if 'cy' in translation_file.name:
                update_json_file(translation_file, FRONTEND_ENVIRONMENTS, cy_translation_object, production_id, non_production_id, key="clientRegistry")
            else:
                update_json_file(translation_file, FRONTEND_ENVIRONMENTS, en_translation_object, production_id, non_production_id, key="clientRegistry")
    update_config_ts(FRONTEND_REPO_PATH / "src/config.ts", production_id, non_production_id, rp_const_name)
    commit_and_push_changes(FRONTEND_REPO_PATH, rp_const_name)

    # Update Backend Repo
    os.chdir(BACKEND_REPO_PATH)
    run_command('cat ../di-account-management-frontend/src/locales/cy/translation.json| jq ".clientRegistry" > src/config/clientRegistry.cy.json')
    run_command('cat ../di-account-management-frontend/src/locales/en/translation.json| jq ".clientRegistry" > src/config/clientRegistry.en.json')

    commit_and_push_changes(BACKEND_REPO_PATH, rp_const_name)

    print("Translation files updated and pushed to new branches.")
    print("WARN: This script is still in development. Please validate changes before committing.")

if __name__ == "__main__":
    main()