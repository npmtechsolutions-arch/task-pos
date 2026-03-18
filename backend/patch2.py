import glob

def fix() -> None:
    files = glob.glob(r'd:\task-pos-main\backend\app\**\*.py', recursive=True)
    for f in files:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            
        new_content = content.replace('Task.assignee)', 'Task.primary_assignee)')
        new_content = new_content.replace('task.assignee', 'task.primary_assignee')
        new_content = new_content.replace('back_populates="assignee"', 'back_populates="primary_assignee"')
        new_content = new_content.replace('assignee=task.primary_assignee', 'primary_assignee=task.primary_assignee')
        
        if new_content != content:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(new_content)
                print(f"Updated {f}")

if __name__ == "__main__":
    fix()
