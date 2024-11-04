import os
import json
import subprocess
from pathlib import Path
import re

# Constants for translation file paths
FRONTEND_TRANSLATION_FILES = [
    'src/locales/en/translation.json',
    'src/locales/cy/translation.json',
]
BACKEND_TRANSLATION_FILES = [
    'src/config/clientRegistry.cy.json',
    'src/config/clientRegistry.en.json'
]

# Number of environments in each repo
FRONTEND_ENVIRONMENTS = ['local', 'dev', 'build', 'staging', 'integration', 'production']
BACKEND_ENVIRONMENTS = ['local', 'dev', 'demo', 'build', 'staging', 'integration', 'production']

# Function to run shell commands
def run_command(command):
    process = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.returncode != 0:
        raise Exception(f"Command failed: {command}\nError: {process.stderr.decode().strip()}")
    return process.stdout.decode().strip()

# Function to update translation files
def update_translation_file(file_path, environments, new_objects, production_id, non_production_id, key=None):
    # Open and read the JSON data from the file
    with open(file_path, 'r+') as file:
        data = json.load(file)

        # Determine the root data structure based on the presence of the key
        root_data = data[key] if key else data

        # Add new translation objects for each environment
        for env in environments:
            if env not in root_data:
                raise KeyError(f"No environment data found for '{env}' in {file_path}")

            # Define the ID based on the environment
            target_id = production_id if env in ["production", "integration"] else non_production_id

            # Update the environment with new translation objects
            root_data[env][target_id] = {
                **root_data[env].get(target_id, {}),
                **new_objects
            }

        # Write the updated data back to the file
        file.seek(0)
        json.dump(data, file, indent=2, ensure_ascii=False)
        file.truncate()

def run_prettier(file_path):
    command = f'npx prettier --write {file_path}'
    process = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.returncode != 0:
        raise Exception(f"Prettier formatting failed: {process.stderr.decode().strip()}")

def update_config_ts(file_path, production_id, non_production_id, rp_const_name):
    with open(file_path, 'r+') as file:
        config_content = file.read()

        # Define the new constants
        prod_const_name = f'{rp_const_name}_PROD'
        non_prod_const_name = f'{rp_const_name}_NON_PROD'
        prod_const = f'const {prod_const_name} = "{production_id}";'
        non_prod_const = f'const {non_prod_const_name} = "{non_production_id}";'

        # Find the specific constant declaration for ABC_PROD
        target_const_pattern = r'const DBS_PROD\s*=\s*".*?";'
        match = re.search(target_const_pattern, config_content)

        if not match:
            return  # Target constant not found; exit the function

        # Find the start of the target constant
        start_position = match.start()
        # Find the end of the block of constant declarations
        end_of_block = config_content.find('\n\n', start_position)

        # If no double newline is found, find the next line that isn't a constant declaration
        if end_of_block == -1:
            end_of_block = re.search(r'(?<=;)\s*(?=[^c])', config_content[start_position:])
            if end_of_block:
                end_of_block = start_position + end_of_block.start()
            else:
                end_of_block = len(config_content)

        # Insert the new constants just before the found end of block
        config_content = (config_content[:end_of_block] + 
                          f'\n{prod_const}\n{non_prod_const}' + 
                          config_content[end_of_block:])

        # Update the getAllowedAccountListClientIDs array
        array_pattern = r'export const getAllowedAccountListClientIDs: string\[] = \[([^\]]*)\];'
        match = re.search(array_pattern, config_content)
        if match:
            # Get the existing array content and strip whitespace
            array_content = [item.strip() for item in match.group(1).split(',')]

            # Check if the new constants are already in the array and add if not
            if prod_const_name not in array_content:
                array_content.append(prod_const_name)
            if non_prod_const_name not in array_content:
                array_content.append(non_prod_const_name)

            # Reformat the array without duplicates and maintain single commas
            new_array_content = ', '.join(filter(None, array_content)).replace(', ,', ',').strip(', ')

            # Replace the array with updated content
            config_content = re.sub(array_pattern, f'export const getAllowedAccountListClientIDs: string[] = [{new_array_content}];', config_content)

        # Write the updated content back to the file
        file.seek(0)
        file.write(config_content)
        file.truncate()
    run_prettier(file_path)
        
# Function to fetch latest from main and create a new branch
def setup_repo(repo_path, branch_name):
    os.chdir(repo_path)
    run_command('git fetch origin')
    run_command('git checkout main')
    run_command('git pull origin main')
    run_command(f'git checkout -b {branch_name}')

# Function to commit and push changes
def commit_and_push_changes(repo_path, rp_const_name):
    os.chdir(repo_path)
    # run_command('git add .')
    # run_command(f'git commit -m "Onboarded RP {rp_const_name}"')
    # run_command(f'git push origin {branch_name}')

def main():
    # Input for branch name and new translation data
    account_bool = input("Oboarding Account(1) or Service(2): ")

    if account_bool == "2":
        print("Onboarding Service currently not supported.")
        return

    # Input for branch name and new translation data
    branch_name = input("Enter the new branch name: ")

    # Input for production ID and non-production ID
    production_id = input("Enter the production environment ID: ")
    non_production_id = input("Enter the non-production environment ID: ")

    # Input for custom constant names
    rp_const_name = input("Enter the name for the RP constant (e.g., DFE_TEACHER_VACANCIES): ")

    # Input for English translations
    link_href = input("Link Href: ")
    print("Enter English translations:")
    en_translation_object = {
        "header": input("Header (English): "),
        "description": input("Description (English): "),
        "link_text": input("Link Text (English): "),
        "link_href": link_href
    }

    # Input for Welsh translations
    print("Enter Welsh translations:")
    cy_translation_object = {
        "header": input("Header (Welsh): "),
        "description": input("Description (Welsh): "),
        "link_text": input("Link Text (Welsh): "),
        "link_href": link_href
    }

    # Paths to frontend and backend repos
    frontend_repo_path = Path("../di-account-management-frontend")
    backend_repo_path = Path("../di-account-management-backend")

    # Update Frontend Repo
    setup_repo(frontend_repo_path, branch_name)
    for translation_file in FRONTEND_TRANSLATION_FILES:
        if Path(translation_file).exists():
            if 'cy' in translation_file:  # Welsh translations
                update_translation_file(translation_file, FRONTEND_ENVIRONMENTS, cy_translation_object, production_id, non_production_id, key="clientRegistry")
            else:  # English translations
                update_translation_file(translation_file, FRONTEND_ENVIRONMENTS, en_translation_object, production_id, non_production_id, key="clientRegistry")
    
    # Update config.ts file
    config_ts_path = Path(frontend_repo_path, "src/config.ts")
    update_config_ts(config_ts_path, production_id, non_production_id, rp_const_name)

    commit_and_push_changes(frontend_repo_path, rp_const_name)

    # Update Backend Repo
    setup_repo(backend_repo_path, branch_name)
    for translation_file in BACKEND_TRANSLATION_FILES:
        if Path(translation_file).exists():
            if 'cy' in translation_file:  # Welsh translations
                update_translation_file(translation_file, BACKEND_ENVIRONMENTS, cy_translation_object, production_id, non_production_id)
            else:  # English translations
                update_translation_file(translation_file, BACKEND_ENVIRONMENTS, en_translation_object, production_id, non_production_id)
    commit_and_push_changes(backend_repo_path, rp_const_name)

    print("Translation files updated and pushed to new branches.")

    print("WARN: This script is still in development. Please validate changes before committing.")

if __name__ == "__main__":
    main()
