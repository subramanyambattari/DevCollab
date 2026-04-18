import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const emptyAuth = { username: '', password: '' };
const emptyRoom = { name: '', inviteCode: '' };
const emptyTask = { title: '', description: '' };
const emptyNote = { title: '', content: '' };

const statusMeta = {
  todo: {
    label: 'To Do',
    dot: 'bg-sky-400'
  },
  doing: {
    label: 'In Progress',
    dot: 'bg-amber-400'
  },
  done: {
    label: 'Done',
    dot: 'bg-emerald-400'
  }
};

function apiHeaders(token, includeJson = true) {
  const headers = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: apiHeaders(token, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed.');
  }

  return payload;
}

function usernameOf(value) {
  if (!value) return 'Unknown';
  if (typeof value === 'string') return value;
  return value.username || value.name || 'Unknown';
}

function groupTasks(tasks) {
  return {
    todo: tasks.filter((task) => task.status === 'todo'),
    doing: tasks.filter((task) => task.status === 'doing'),
    done: tasks.filter((task) => task.status === 'done')
  };
}

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function Feedback({ feedback }) {
  if (!feedback) return null;

  const styles =
    feedback.type === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
      : 'border-rose-500/20 bg-rose-500/10 text-rose-100';

  return (
    <div className={`glass mb-4 rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      {feedback.message}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('devcollab-token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(emptyAuth);
  const [rooms, setRooms] = useState([]);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [roomEditName, setRoomEditName] = useState('');
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [noteForm, setNoteForm] = useState(emptyNote);
  const [messageText, setMessageText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const socketRef = useRef(null);
  const selectedRoomIdRef = useRef('');

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  const clearFeedbackSoon = (delay = 2200) => {
    window.setTimeout(() => setFeedback(null), delay);
  };

  const showSuccess = (message) => {
    setFeedback({ type: 'success', message });
    clearFeedbackSoon();
  };

  const showError = (message) => {
    setFeedback({ type: 'error', message });
  };

  const logout = () => {
    localStorage.removeItem('devcollab-token');
    setToken('');
    setUser(null);
    setRooms([]);
    setSelectedRoomId('');
    setDashboard(null);
    setFeedback(null);
  };

  const loadRooms = async (authToken = token) => {
    const data = await request('/api/rooms', { token: authToken });
    setRooms(data.rooms || []);
    return data.rooms || [];
  };

  const loadDashboard = async (roomId, authToken = token) => {
    if (!roomId) return;
    const data = await request(`/api/rooms/${roomId}/dashboard`, { token: authToken });
    setDashboard(data);
    setSelectedRoomId(roomId);
    setRoomEditName(data.room?.name || '');
  };

  useEffect(() => {
    if (!token) {
      setUser(null);
      setRooms([]);
      setDashboard(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const me = await request('/api/auth/me', { token });
        if (cancelled) return;
        setUser(me.user);
        const roomList = await loadRooms(token);
        if (!selectedRoomIdRef.current && roomList.length) {
          await loadDashboard(roomList[0].id, token);
        }
      } catch (err) {
        if (!cancelled) {
          logout();
          showError(err.message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(window.location.origin, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (selectedRoomIdRef.current) {
        socket.emit('room:join', { roomId: selectedRoomIdRef.current });
      }
    });

    socket.on('room:error', (payload) => {
      showError(payload?.message || 'Room error.');
    });

    socket.on('rooms:updated', async () => {
      try {
        const roomList = await loadRooms();
        const currentRoomId = selectedRoomIdRef.current;
        if (!currentRoomId) return;

        try {
          await loadDashboard(currentRoomId);
        } catch (dashboardError) {
          const stillExists = roomList.some((room) => room.id === currentRoomId);
          if (!stillExists) {
            setDashboard(null);
            setSelectedRoomId('');
            setRoomEditName('');
          }
        }
      } catch (refreshError) {
        showError(refreshError.message);
      }
    });

    socket.on('message:new', (message) => {
      if (message.room !== selectedRoomIdRef.current) return;
      setDashboard((current) => {
        if (!current || current.room.id !== message.room) return current;
        return {
          ...current,
          messages: [...current.messages, message]
        };
      });
    });

    socket.on('tasks:updated', ({ roomId, tasks }) => {
      if (roomId !== selectedRoomIdRef.current) return;
      setDashboard((current) => (current && current.room.id === roomId ? { ...current, tasks } : current));
    });

    socket.on('notes:updated', ({ roomId, notes }) => {
      if (roomId !== selectedRoomIdRef.current) return;
      setDashboard((current) => (current && current.room.id === roomId ? { ...current, notes } : current));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (socketRef.current && selectedRoomId) {
      socketRef.current.emit('room:join', { roomId: selectedRoomId });
    }
  }, [selectedRoomId]);

  const groupedTasks = useMemo(() => groupTasks(dashboard?.tasks || []), [dashboard?.tasks]);
  const isRoomOwner = Boolean(dashboard?.room?.owner?._id && user?.id && dashboard.room.owner._id === user.id);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await request(endpoint, {
        method: 'POST',
        body: authForm
      });

      localStorage.setItem('devcollab-token', data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthForm(emptyAuth);
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const data = await request('/api/rooms', {
        token,
        method: 'POST',
        body: { name: roomForm.name }
      });
      setRoomForm((current) => ({ ...current, name: '' }));
      const updatedRooms = await loadRooms();
      setRooms(updatedRooms);
      await loadDashboard(data.room.id);
      showSuccess('Room created.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const data = await request('/api/rooms/join', {
        token,
        method: 'POST',
        body: { inviteCode: roomForm.inviteCode }
      });
      setRoomForm((current) => ({ ...current, inviteCode: '' }));
      const updatedRooms = await loadRooms();
      setRooms(updatedRooms);
      await loadDashboard(data.room.id);
      showSuccess('Joined room.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectRoom = async (roomId) => {
    setSelectedRoomId(roomId);
    setFeedback(null);
    await loadDashboard(roomId);
  };

  const handleUpdateRoom = async (event) => {
    event.preventDefault();
    if (!selectedRoomId) return;

    setBusy(true);
    setFeedback(null);

    try {
      await request(`/api/rooms/${selectedRoomId}`, {
        token,
        method: 'PATCH',
        body: { name: roomEditName }
      });
      await loadRooms();
      await loadDashboard(selectedRoomId);
      showSuccess('Room updated.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoomId) return;

    const confirmDelete = window.confirm('Delete this room and all related messages, tasks, and notes?');
    if (!confirmDelete) return;

    setBusy(true);
    setFeedback(null);

    try {
      await request(`/api/rooms/${selectedRoomId}`, {
        token,
        method: 'DELETE'
      });
      const updatedRooms = await loadRooms();
      if (updatedRooms.length > 0) {
        await loadDashboard(updatedRooms[0].id);
      } else {
        setDashboard(null);
        setSelectedRoomId('');
        setRoomEditName('');
      }
      showSuccess('Room deleted.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !selectedRoomId) return;

    setMessageText('');
    setFeedback(null);

    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('message:send', { roomId: selectedRoomId, text });
        return;
      }

      const data = await request(`/api/rooms/${selectedRoomId}/messages`, {
        token,
        method: 'POST',
        body: { text }
      });
      setDashboard((current) =>
        current && current.room.id === selectedRoomId
          ? { ...current, messages: [...current.messages, data.message] }
          : current
      );
    } catch (err) {
      showError(err.message);
    }
  };

  const handleAddTask = async (event) => {
    event.preventDefault();
    if (!selectedRoomId) return;
    setBusy(true);
    setFeedback(null);

    try {
      await request(`/api/rooms/${selectedRoomId}/tasks`, {
        token,
        method: 'POST',
        body: taskForm
      });
      setTaskForm(emptyTask);
      await loadDashboard(selectedRoomId);
      showSuccess('Task added.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const moveTask = async (task, nextStatus) => {
    if (!selectedRoomId) return;
    setFeedback(null);

    try {
      await request(`/api/rooms/${selectedRoomId}/tasks/${task.id}`, {
        token,
        method: 'PATCH',
        body: { status: nextStatus }
      });
      await loadDashboard(selectedRoomId);
      showSuccess('Task updated.');
    } catch (err) {
      showError(err.message);
    }
  };

  const deleteTask = async (task) => {
    if (!selectedRoomId) return;
    setFeedback(null);

    try {
      await request(`/api/rooms/${selectedRoomId}/tasks/${task.id}`, {
        token,
        method: 'DELETE'
      });
      await loadDashboard(selectedRoomId);
      showSuccess('Task deleted.');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleAddNote = async (event) => {
    event.preventDefault();
    if (!selectedRoomId) return;
    setBusy(true);
    setFeedback(null);

    try {
      await request(`/api/rooms/${selectedRoomId}/notes`, {
        token,
        method: 'POST',
        body: noteForm
      });
      setNoteForm(emptyNote);
      await loadDashboard(selectedRoomId);
      showSuccess('Note added.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteNote = async (note) => {
    if (!selectedRoomId) return;
    setFeedback(null);

    try {
      await request(`/api/rooms/${selectedRoomId}/notes/${note.id}`, {
        token,
        method: 'DELETE'
      });
      await loadDashboard(selectedRoomId);
      showSuccess('Note deleted.');
    } catch (err) {
      showError(err.message);
    }
  };

  const copyInviteCode = async () => {
    if (!dashboard?.room?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(dashboard.room.inviteCode);
      showSuccess('Invite code copied.');
    } catch (clipboardError) {
      showError('Could not copy invite code.');
    }
  };

  if (!token || !user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_22%)]" />
        <div className="glass relative z-10 w-full max-w-2xl rounded-[2rem] p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="section-title">DevCollab</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Ship together in one shared workspace.
              </h1>
            </div>
            <div className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 sm:block">
              React + Node + Socket.IO
            </div>
          </div>

          <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Create a room, chat in real time, track work with a Kanban board, and keep team notes in sync.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              className={authMode === 'login' ? 'button-primary' : 'button-secondary'}
              onClick={() => setAuthMode('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={authMode === 'register' ? 'button-primary' : 'button-secondary'}
              onClick={() => setAuthMode('register')}
              type="button"
            >
              Register
            </button>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleAuthSubmit}>
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Username
              <input
                className="input-base"
                value={authForm.username}
                onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })}
                placeholder="alex"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Password
              <input
                className="input-base"
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                placeholder="********"
              />
            </label>
            <button className="button-primary mt-2" disabled={busy} type="submit">
              {busy ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

          <div className="mt-4">
            <Feedback feedback={feedback} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1700px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="glass flex flex-col gap-4 rounded-[2rem] p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="section-title">DevCollab</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{user.username}</h2>
              <p className="mt-1 text-sm text-slate-400">Workspace owner or member</p>
            </div>
            <button className="button-secondary shrink-0" onClick={logout} type="button">
              Logout
            </button>
          </div>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-slate-200">Rooms</p>
            <form className="grid gap-3" onSubmit={handleCreateRoom}>
              <input
                className="input-base"
                value={roomForm.name}
                onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })}
                placeholder="Design Sprint"
              />
              <button className="button-primary" disabled={busy} type="submit">
                Create room
              </button>
            </form>
            <form className="grid gap-3" onSubmit={handleJoinRoom}>
              <input
                className="input-base"
                value={roomForm.inviteCode}
                onChange={(event) => setRoomForm({ ...roomForm, inviteCode: event.target.value })}
                placeholder="ABC123"
              />
              <button className="button-secondary" disabled={busy} type="submit">
                Join room
              </button>
            </form>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">Your rooms</p>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                {rooms.length}
              </span>
            </div>

            <div className="grid gap-2 overflow-auto pr-1">
              {rooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                  No rooms yet. Create one to get started.
                </div>
              ) : null}
              {rooms.map((room) => {
                const active = room.id === selectedRoomId;
                return (
                  <button
                    key={room.id}
                    className={[
                      'rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5',
                      active
                        ? 'border-cyan-400/40 bg-cyan-400/10 shadow-lg shadow-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    ].join(' ')}
                    onClick={() => handleSelectRoom(room.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-white">{room.name}</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        {room.inviteCode}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Owner {usernameOf(room.owner)} | {room.members?.length || 0} members
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="glass rounded-[2rem] p-4 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="section-title">Shared workspace</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                  {dashboard?.room?.name || 'Select a room'}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                  Keep everything in one place: live chat, task tracking, and shared notes all update in real time.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Messages</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{dashboard?.messages?.length || 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Tasks</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{dashboard?.tasks?.length || 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Notes</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{dashboard?.notes?.length || 0}</div>
                </div>
                {dashboard?.room?.inviteCode ? (
                  <button className="button-secondary whitespace-nowrap" onClick={copyInviteCode} type="button">
                    Copy code {dashboard.room.inviteCode}
                  </button>
                ) : null}
              </div>
            </div>

            {dashboard && isRoomOwner ? (
              <form className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_auto_auto] md:items-center" onSubmit={handleUpdateRoom}>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Room settings</p>
                  <input
                    className="input-base mt-2"
                    value={roomEditName}
                    onChange={(event) => setRoomEditName(event.target.value)}
                    placeholder="Room name"
                  />
                </div>
                <button className="button-primary md:self-end" disabled={busy} type="submit">
                  Save name
                </button>
                <button
                  className="button-secondary border-rose-500/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 md:self-end"
                  disabled={busy}
                  onClick={handleDeleteRoom}
                  type="button"
                >
                  Delete room
                </button>
              </form>
            ) : null}

            <div className="mt-4">
              <Feedback feedback={feedback} />
            </div>
          </div>

          {!dashboard ? (
            <div className="glass mt-4 grid min-h-[50vh] place-items-center rounded-[2rem] p-8 text-center">
              <div>
                <p className="section-title">No room selected</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Choose a room or create a new one</h2>
                <p className="mt-2 text-slate-400">Your workspace will appear here once a room is active.</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 2xl:grid-cols-[1.2fr_1.05fr_0.95fr]">
              <section className="glass flex min-h-[620px] flex-col rounded-[2rem] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="section-title">Live chat</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Team conversation</h3>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                    Live updates
                  </span>
                </div>

                <div className="mt-4 flex-1 space-y-3 overflow-auto pr-1">
                  {dashboard.messages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                      No messages yet. Start the conversation.
                    </div>
                  ) : null}
                  {dashboard.messages.map((message) => (
                    <article
                      key={message.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-white">{usernameOf(message.sender)}</strong>
                        <span className="text-xs text-slate-500">{formatTime(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {message.text}
                      </p>
                    </article>
                  ))}
                </div>

                <form className="mt-4 flex gap-3" onSubmit={handleSendMessage}>
                  <input
                    className="input-base flex-1"
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Send a message..."
                  />
                  <button className="button-primary shrink-0 px-5" type="submit">
                    Send
                  </button>
                </form>
              </section>

              <section className="glass rounded-[2rem] p-4 sm:p-5">
                <div className="border-b border-white/10 pb-4">
                  <p className="section-title">Kanban</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Task board</h3>
                </div>

                <form className="mt-4 grid gap-3" onSubmit={handleAddTask}>
                  <input
                    className="input-base"
                    value={taskForm.title}
                    onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                    placeholder="Task title"
                  />
                  <input
                    className="input-base"
                    value={taskForm.description}
                    onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
                    placeholder="Task details"
                  />
                  <button className="button-secondary" disabled={busy} type="submit">
                    Add task
                  </button>
                </form>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  {['todo', 'doing', 'done'].map((status) => {
                    const meta = statusMeta[status];
                    return (
                      <div key={status} className="rounded-3xl border border-white/10 bg-slate-950/40 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                            <h4 className="text-sm font-semibold text-white">{meta.label}</h4>
                          </div>
                          <span className="text-xs text-slate-500">{groupedTasks[status].length}</span>
                        </div>

                        <div className="space-y-3">
                          {groupedTasks[status].length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                              Empty column
                            </div>
                          ) : null}
                          {groupedTasks[status].map((task) => (
                            <article key={task.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <strong className="text-sm text-white">{task.title}</strong>
                                <button
                                  className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-rose-200 transition hover:bg-rose-500/10"
                                  onClick={() => deleteTask(task)}
                                  type="button"
                                  title="Delete task"
                                >
                                  x
                                </button>
                              </div>

                              {task.description ? (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                                  {task.description}
                                </p>
                              ) : null}

                              <div className="mt-4 flex flex-wrap gap-2">
                                {status !== 'todo' ? (
                                  <button className="button-ghost" onClick={() => moveTask(task, 'todo')} type="button">
                                    To Do
                                  </button>
                                ) : null}
                                {status !== 'doing' ? (
                                  <button className="button-ghost" onClick={() => moveTask(task, 'doing')} type="button">
                                    Doing
                                  </button>
                                ) : null}
                                {status !== 'done' ? (
                                  <button className="button-ghost" onClick={() => moveTask(task, 'done')} type="button">
                                    Done
                                  </button>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="glass rounded-[2rem] p-4 sm:p-5">
                <div className="border-b border-white/10 pb-4">
                  <p className="section-title">Shared notes</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Team notes</h3>
                </div>

                <form className="mt-4 grid gap-3" onSubmit={handleAddNote}>
                  <input
                    className="input-base"
                    value={noteForm.title}
                    onChange={(event) => setNoteForm({ ...noteForm, title: event.target.value })}
                    placeholder="Note title"
                  />
                  <textarea
                    className="input-base min-h-[140px] resize-none"
                    rows="5"
                    value={noteForm.content}
                    onChange={(event) => setNoteForm({ ...noteForm, content: event.target.value })}
                    placeholder="Capture ideas, decisions, or meeting notes..."
                  />
                  <button className="button-primary" disabled={busy} type="submit">
                    Add note
                  </button>
                </form>

                <div className="mt-4 space-y-3">
                  {dashboard.notes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                      No notes yet. Add a shared note for the team.
                    </div>
                  ) : null}
                  {dashboard.notes.map((note) => (
                    <article key={note.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <strong className="text-sm text-white">{note.title}</strong>
                        <button
                          className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-rose-200 transition hover:bg-rose-500/10"
                          onClick={() => deleteNote(note)}
                          type="button"
                          title="Delete note"
                        >
                          x
                        </button>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{note.content}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>By {usernameOf(note.createdBy)}</span>
                        <span>{formatTime(note.updatedAt || note.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
