import os
import glob
import re

def fix() -> None:
    files = glob.glob(r'd:\task-pos-main\backend\app\**\*.py', recursive=True)
    for f in files:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            
        new_content = content.replace('Task.assignee_id', 'Task.primary_assignee_id')
        new_content = new_content.replace('foreign_keys="Task.assignee_id"', 'foreign_keys="Task.primary_assignee_id"')
        
        # In task.py service
        if 'services\\task.py' in f or 'services/task.py' in f:
            new_content = new_content.replace('assignee_id=task_data.assignee_id', 'primary_assignee_id=task_data.assignee_id')
            new_content = new_content.replace('assignee_id=update_data.assignee_id', 'primary_assignee_id=update_data.assignee_id')
            
        if new_content != content:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(new_content)
                print(f"Updated {f}")

if __name__ == "__main__":
    fix()
