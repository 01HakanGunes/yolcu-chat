# Project Roadmap & TODO

## Immediate Next Steps

- [x] Replace all logos and images with my own branding.
- [x] Implement group chatrooms. index page shows the joined rooms, clicking a room opens the chat.
- [x] Add a way to leave rooms and kick for admins.
- [ ] only receive push notifications for messages in rooms the user is a participant of.
- [ ] A way to reload the chat somehow or an automatic refresh. there could be missing messages if the user is offline for a while.

## Refined Global Chat

- [x] **Sender Info**: Join `messages` with `profiles` to show username/avatar on chat bubbles.
- [ ] **Pagination**: Implement "Load More" or infinite scroll to fetch messages in batches (limit 20).

- [x] **Schema Update**: Create `rooms` and `room_participants` tables.
- [ ] **Contacts/Search**: Search for users to start a conversation with.
- [ ] **Chat Room UI**: Support dynamic routing for `app/chat/[roomId].tsx`.
- [ ] **Inbox**: List active conversations in `(tabs)/index.tsx` instead of global chat.

## Media & Polish

- [ ] **Image Upload**: Send images to Supabase Storage.
- [ ] **Messages Status**: Sent, Delivered, Read indicators.
- [x] **Push Notifications**: Notify on new message.

## Known Issues / Bugs

- [x] **Keyboard Overlap**: On some devices, keyboard overlaps input field.
- [x] double back button appears on the chat screen
