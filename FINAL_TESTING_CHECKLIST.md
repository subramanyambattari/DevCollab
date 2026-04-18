# DevCollab Final Testing Checklist

Use this checklist to confirm the deployed app is working end to end.

## 1. Login

- Open the Render URL.
- Register a new user or log in.
- Confirm you land on the workspace dashboard.

Pass condition:
- You can see your username, room list, and the main workspace.

## 2. Create Room

- Type a room name in the left panel.
- Click `Create room`.
- Confirm the room appears under `Your rooms`.
- Confirm the invite code appears on the room card and top header.

Pass condition:
- The room appears immediately and still exists after refresh.

## 3. Join Room From Another Tab

- Open the app in a second tab or browser.
- Log in with another user if possible.
- Enter the invite code and click `Join room`.

Pass condition:
- The same room appears in the second tab.

## 4. Test Chat

- Send a message from one tab.
- Watch the other tab.

Pass condition:
- The message appears in both tabs.
- Refresh the page and confirm the chat history is still there.

## 5. Test Tasks

- Add a task in the Kanban section.
- Move it between `To Do`, `In Progress`, and `Done`.
- Delete one task.

Pass condition:
- The task moves correctly and persists until deleted.

## 6. Test Notes

- Add a shared note.
- Refresh the page.
- Delete the note.

Pass condition:
- The note persists after refresh and deletes cleanly.

## 7. Test Persistence

- Refresh the page after creating a room, sending a message, adding a task, and adding a note.

Pass condition:
- All saved data is still there after refresh.

## 8. Test Responsive Layout

- Shrink the browser window.
- Check that the sidebar and panels remain usable.

Pass condition:
- No overlap or broken layout on smaller screens.

## 9. Test Logout/Login

- Click `Logout`.
- Log in again.

Pass condition:
- You return to the auth screen and can sign back in normally.

