import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowLeft, ArrowUpRight, Check, ChevronLeft, Clipboard, Copy, Disc3, FileText,
  FolderOpen, Headphones, Link2, ListMusic, Menu, MoreHorizontal, Music2,
  Pause, Pencil, Play, Plus, Search, Settings, Share2, SlidersHorizontal,
  Trash2, X, Zap,
} from 'lucide-react';
import {
  Link, Route, Switch, useLocation, useParams, Router as WouterRouter,
} from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { useYouTubePlayer } from '@/hooks/use-youtube-player';
import { getYouTubeVideoId } from '@/lib/youtube';

type Category = 'Vocal' | 'Drums' | 'Bass' | 'Guitar' | 'Instruments' | 'Arrangement' | 'Mix' | 'Mood' | 'Other';
type Project = { id: string; title: string; artist: string; description: string; references: Reference[]; createdAt: string; updatedAt: string };
type Reference = { id: string; title: string; artist: string; url: string; artwork: string; notes: string; markers: Marker[] };
type Marker = { id: string; timestamp: number; category: Category; whatILike: string; howIWantToUseIt: string; createdAt: string };
type Notice = (message: string, tone?: 'success' | 'error') => void;
type ConfirmRequest = { title: string; message: string; confirmLabel: string; onConfirm: () => void };
const ConfirmContext = createContext<(request: ConfirmRequest) => void>(() => undefined);
const useConfirm = () => useContext(ConfirmContext);
const categories: Category[] = ['Vocal', 'Drums', 'Bass', 'Guitar', 'Instruments', 'Arrangement', 'Mix', 'Mood', 'Other'];
const storageKey = 'refmap-projects-v1';

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();
const initials = (title: string) => title.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'R';
const formatDate = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return hours ? `${hours}:${minutes.toString().padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
};
/** Parses "s", "m:ss" or "h:mm:ss"; returns null for anything else. */
const parseTime = (value: string) => {
  if (!/^\d+(:\d{1,2}){0,2}$/.test(value.trim())) return null;
  const parts = value.trim().split(':').map(Number);
  if (parts.slice(1).some((part) => part >= 60)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
};
const isHttpUrl = (value: string) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

// Demo data. Videos are official uploads checked to play in an embedded player; marker times are illustrative and stay within each video's length.
const youTubeThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
const seedProjects = (): Project[] => [{
  id: 'night-transit',
  title: 'Night Transit',
  artist: 'Demo Artist',
  description: 'A late-night J-pop single: a fast, agile vocal, a funky low end, and a chorus that bursts open without losing the intimacy.',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-12T16:42:00.000Z',
  references: [
    {
      id: 'ref-kaibutsu',
      title: '怪物',
      artist: 'YOASOBI',
      url: 'https://www.youtube.com/watch?v=dy90tA3TT1c',
      artwork: youTubeThumb('dy90tA3TT1c'),
      notes: 'Fast, dramatic J-pop: a tight, agile vocal riding a dense electronic arrangement.',
      markers: [
        { id: 'm-kaibutsu-1', timestamp: 3, category: 'Arrangement', whatILike: 'The song gets going almost immediately, with no long intro.', howIWantToUseIt: 'Skip the long intro and start with the hook motif under the first vocal line.', createdAt: '2026-10-02T12:00:00.000Z' },
        { id: 'm-kaibutsu-2', timestamp: 31, category: 'Vocal', whatILike: 'A light, clear lead that stays precise even at this tempo.', howIWantToUseIt: 'Keep the verse vocal small and close; save the power for the chorus.', createdAt: '2026-10-02T12:00:00.000Z' },
        { id: 'm-kaibutsu-3', timestamp: 58, category: 'Instruments', whatILike: 'Synths and keys stack up to make the section feel bigger without slowing down.', howIWantToUseIt: 'Hold the tempo into the chorus and stack synths and backing vocals for the lift.', createdAt: '2026-10-02T12:00:00.000Z' },
        { id: 'm-kaibutsu-4', timestamp: 182, category: 'Mood', whatILike: 'The last stretch feels urgent and bittersweet at the same time.', howIWantToUseIt: 'Keep the final chorus bright, but end on a chord that leaves a little unresolved.', createdAt: '2026-10-02T12:00:00.000Z' },
      ],
    },
    {
      id: 'ref-kaikai-kitan',
      title: '廻廻奇譚',
      artist: 'Eve',
      url: 'https://www.youtube.com/watch?v=1tk1pqwrOys',
      artwork: youTubeThumb('1tk1pqwrOys'),
      notes: 'Aggressive band energy with sharp edits: guitars and drums that keep changing shape.',
      markers: [
        { id: 'm-kaikai-1', timestamp: 4, category: 'Guitar', whatILike: 'The guitars hit hard and fast straight away.', howIWantToUseIt: 'Use a short, punchy guitar figure as the hook of the second track.', createdAt: '2026-10-05T09:00:00.000Z' },
        { id: 'm-kaikai-2', timestamp: 47, category: 'Drums', whatILike: 'Busy drums that push the vocal forward without burying it.', howIWantToUseIt: 'Program fills between vocal phrases, never on top of them.', createdAt: '2026-10-05T09:00:00.000Z' },
        { id: 'm-kaikai-3', timestamp: 128, category: 'Mix', whatILike: 'Dense, but every element still has its own space.', howIWantToUseIt: 'Carve EQ room for the vocal first, then fit the guitars around it.', createdAt: '2026-10-05T09:00:00.000Z' },
      ],
    },
    {
      id: 'ref-overdose',
      title: 'Overdose',
      artist: 'なとり',
      url: 'https://www.youtube.com/watch?v=H08YWE4CIFQ',
      artwork: youTubeThumb('H08YWE4CIFQ'),
      notes: 'Laid-back city-pop groove: the bass and a relaxed vocal do most of the work.',
      markers: [
        { id: 'm-overdose-1', timestamp: 9, category: 'Bass', whatILike: 'A bouncy bass line that carries the groove on its own.', howIWantToUseIt: 'Write the bass part before the chords and let it lead the verse.', createdAt: '2026-10-08T14:00:00.000Z' },
        { id: 'm-overdose-2', timestamp: 42, category: 'Vocal', whatILike: 'A cool, almost whispered delivery that sits right in the pocket.', howIWantToUseIt: 'Record the verses softer and closer to the mic, and leave the timing a little loose.', createdAt: '2026-10-08T14:00:00.000Z' },
        { id: 'm-overdose-3', timestamp: 151, category: 'Mood', whatILike: 'Stylish and a little melancholy, like a late-night drive.', howIWantToUseIt: 'Use 7th chords and filtered keys in the bridge to get the same night colour.', createdAt: '2026-10-08T14:00:00.000Z' },
      ],
    },
  ],
}];

// Bump when the demo project changes so browsers with older saved data receive it once.
const demoVersion = '2';
const demoVersionKey = 'refmap-demo-version';

// Browser storage only (no backend). Unreadable or malformed data falls back to the demo data.
function useProjects(onSaveError: () => void) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      if (!Array.isArray(parsed)) return seedProjects();
      const items = parsed as Project[];
      // Offer the current demo once to existing data; a demo the user later deletes is not re-added.
      if (localStorage.getItem(demoVersionKey) === demoVersion) return items;
      const [demo] = seedProjects();
      return items.some((item) => item.id === demo.id) ? items : [demo, ...items];
    } catch { return seedProjects(); }
  });
  useEffect(() => {
    try { localStorage.setItem(demoVersionKey, demoVersion); } catch { /* reported by the save below */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(projects)); } catch { onSaveError(); }
  }, [projects]);
  return [projects, setProjects] as const;
}

function App() {
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const notify: Notice = (message, tone = 'success') => setNotice({ message, tone });
  const [projects, setProjects] = useProjects(() => notify('Could not save — browser storage is full or blocked', 'error'));
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.tone === 'error' ? 4200 : 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return (
    <ConfirmContext.Provider value={setConfirmRequest}>
      <TooltipProvider>
        {/* Hash routing (#/projects/...) keeps every view working on any static host without server rewrites. */}
        <WouterRouter hook={useHashLocation}>
          <Shell>
            <RoutedErrorBoundary>
              <Switch>
                {/* Render children, not inline `component` arrows: a new component type each App render would remount the page and reset its state. */}
                <Route path="/"><Dashboard projects={projects} setProjects={setProjects} notify={notify} /></Route>
                <Route path="/projects/:projectId/references/:referenceId">{({ referenceId }) => <ReferencePlayer key={referenceId} projects={projects} setProjects={setProjects} notify={notify} />}</Route>
                <Route path="/projects/:projectId/brief"><Brief projects={projects} notify={notify} /></Route>
                <Route path="/projects/:projectId">{({ projectId }) => <Workspace key={projectId} projects={projects} setProjects={setProjects} notify={notify} />}</Route>
                <Route path="/settings"><SettingsPage projects={projects} setProjects={setProjects} notify={notify} /></Route>
                <Route component={NotFound} />
              </Switch>
            </RoutedErrorBoundary>
          </Shell>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
      {notice && <div className={`toast ${notice.tone === 'error' ? 'toast-error' : ''}`} role={notice.tone === 'error' ? 'alert' : 'status'} data-testid="status-toast">{notice.message}</div>}
      {confirmRequest && <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmModal({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  return <Modal title={request.title} onClose={onClose}><p className="confirm-message">{request.message}</p><div className="modal-footer"><button className="button button-secondary" onClick={onClose} autoFocus data-testid="button-confirm-cancel">Cancel</button><button className="button button-primary button-destructive" onClick={() => { request.onConfirm(); onClose(); }} data-testid="button-confirm-ok">{request.confirmLabel}</button></div></Modal>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const navItems = [
    { href: '/', label: 'My Projects', icon: FolderOpen },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark" /><span className="brand-name">ref<b>map</b></span></Link>
        <div className="side-label">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${location === href || (href === '/' && location.startsWith('/projects')) ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}><Icon />{label}</Link>)}
        </nav>
        <div className="sidebar-footer"><strong>SESSION NOTEBOOK</strong>Turn instinct into language.<br />Keep the useful parts.</div>
      </aside>
      <header className="topbar">
        <Link href="/" className="brand" data-testid="link-mobile-brand"><span className="brand-mark" /><span className="brand-name">ref<b>map</b></span></Link>
        <nav className="mobile-nav">
          <Link href="/" className={location === '/' || location.startsWith('/projects') ? 'active' : ''} data-testid="link-mobile-projects"><FolderOpen size={18} /></Link>
          <Link href="/settings" className={location === '/settings' ? 'active' : ''} data-testid="link-mobile-settings"><Settings size={18} /></Link>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

function Dashboard({ projects, setProjects, notify }: { projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>; notify: Notice }) {
  const [, setLocation] = useLocation();
  const confirm = useConfirm();
  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Project | undefined>();
  const create = (data: Pick<Project, 'title' | 'artist' | 'description'>) => {
    const project: Project = { ...data, id: id(), references: [], createdAt: now(), updatedAt: now() };
    setProjects((items) => [project, ...items]);
    setModal(null); notify('Project created');
    setLocation(`/projects/${project.id}`);
  };
  const update = (data: Pick<Project, 'title' | 'artist' | 'description'>) => {
    if (!editing) return;
    setProjects((items) => items.map((item) => item.id === editing.id ? { ...item, ...data, updatedAt: now() } : item));
    setModal(null); setEditing(undefined); notify('Project details saved');
  };
  const remove = (project: Project) => confirm({
    title: 'Delete project?', message: `“${project.title}” and all of its references and markers will be removed. This cannot be undone.`, confirmLabel: 'Delete project',
    onConfirm: () => { setProjects((items) => items.filter((item) => item.id !== project.id)); notify('Project deleted'); },
  });
  return (
    <div className="page">
      <div className="page-header">
        <div><div className="eyebrow">RefMap / Workspace</div><h1>My Projects</h1><p className="subtle" style={{ marginTop: 12 }}>The references behind the records you are making.</p></div>
        <button className="button button-primary" onClick={() => setModal('new')} data-testid="button-new-project"><Plus /> New project</button>
      </div>
      {projects.length === 0 ? <div className="empty-state"><Music2 size={28} /><h3>Your workspace is quiet.</h3><p>Start a project to collect the sounds, moments, and decisions you want to carry into the room.</p><button className="button button-primary" onClick={() => setModal('new')} data-testid="button-empty-new-project">Create your first project</button></div> : (
        <div className="project-grid">
          {projects.map((project) => {
            const markerCount = project.references.reduce((sum, ref) => sum + ref.markers.length, 0);
            return <article className="panel project-card" key={project.id} data-testid={`card-project-${project.id}`}>
              <div className="project-card-main" onClick={() => setLocation(`/projects/${project.id}`)} onKeyDown={(event) => { if (event.key === 'Enter') setLocation(`/projects/${project.id}`); }} role="button" tabIndex={0} style={{ textAlign: 'left', background: 'transparent', border: 0, color: 'inherit' }} data-testid={`button-open-project-${project.id}`}>
                <div className="project-card-top"><span className="project-art">{initials(project.title)}</span><button className="icon-button" onClick={(event) => { event.stopPropagation(); setEditing(project); setModal('edit'); }} aria-label={`Edit ${project.title}`} data-testid={`button-edit-project-${project.id}`}><MoreHorizontal size={17} /></button></div>
                <div className="project-title">{project.title}</div><div className="project-description">{project.description || 'No project description yet.'}</div>
                <div className="project-meta"><div><span className="meta-number">{project.references.length}</span><span className="meta-label">references</span></div><div><span className="meta-number">{markerCount}</span><span className="meta-label">markers</span></div></div>
              </div>
              <div className="project-card-footer"><span>edited {formatDate(project.updatedAt)}</span><button className="button button-ghost button-small button-danger" onClick={() => remove(project)} data-testid={`button-delete-project-${project.id}`}><Trash2 size={13} /> Delete</button></div>
            </article>;
          })}
          <button className="panel new-project-card" onClick={() => setModal('new')} data-testid="button-new-project-card"><span><Plus /><span>New project</span></span></button>
        </div>
      )}
      {modal && <ProjectModal mode={modal} initial={modal === 'edit' ? editing : undefined} onClose={() => { setModal(null); setEditing(undefined); }} onSave={modal === 'new' ? create : update} />}
    </div>
  );
}

function Workspace({ projects, setProjects, notify }: { projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>; notify: Notice }) {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const project = projects.find((item) => item.id === projectId);
  const [view, setView] = useState<'tracks' | 'map'>('tracks');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | Category>('All');
  const [modal, setModal] = useState<'reference' | 'editReference' | 'edit' | null>(null);
  const [editingReference, setEditingReference] = useState<Reference | undefined>();
  const confirm = useConfirm();
  if (!project) return <Missing title="Project not found" back="/" />;
  const updateProject = (next: Project) => setProjects((items) => items.map((item) => item.id === next.id ? { ...next, updatedAt: now() } : item));
  const addReference = (data: Omit<Reference, 'id' | 'markers'>) => {
    updateProject({ ...project, references: [...project.references, { ...data, id: id(), markers: [] }] });
    setModal(null); notify('Reference added');
  };
  const editReference = (data: Omit<Reference, 'id' | 'markers'>) => {
    if (!editingReference) return;
    updateProject({ ...project, references: project.references.map((item) => item.id === editingReference.id ? { ...item, ...data } : item) });
    setModal(null); setEditingReference(undefined); notify('Reference details saved');
  };
  const editProject = (data: Pick<Project, 'title' | 'artist' | 'description'>) => {
    updateProject({ ...project, ...data }); setModal(null); notify('Project details saved');
  };
  const removeReference = (reference: Reference) => confirm({
    title: 'Remove reference?', message: `“${reference.title}” and its ${reference.markers.length} ${reference.markers.length === 1 ? 'marker' : 'markers'} will be removed from this project.`, confirmLabel: 'Remove reference',
    onConfirm: () => { updateProject({ ...project, references: project.references.filter((item) => item.id !== reference.id) }); notify('Reference removed'); },
  });
  const filtered = project.references.filter((reference) => {
    const term = search.toLowerCase();
    const matchSearch = !term || `${reference.title} ${reference.artist} ${reference.notes}`.toLowerCase().includes(term);
    const matchCategory = filter === 'All' || reference.markers.some((marker) => marker.category === filter);
    return matchSearch && matchCategory;
  });
  const allMarkers = project.references.flatMap((reference) => reference.markers.map((marker) => ({ marker, reference }))).filter(({ marker }) => filter === 'All' || marker.category === filter);
  return (
    <div className="page">
      <div className="workspace-header">
        <Link href="/" className="crumb" data-testid="link-back-projects"><ChevronLeft size={13} /> All projects</Link>
        <div className="workspace-title-row"><div><div className="eyebrow">Project workspace</div><h1>{project.title}</h1><div className="workspace-title-meta"><span>{project.artist || 'No artist'}</span><span>{project.references.length} references</span><span>{project.references.reduce((sum, reference) => sum + reference.markers.length, 0)} markers</span></div></div><div className="workspace-actions"><button className="button button-secondary" onClick={() => setModal('edit')} data-testid="button-edit-workspace"><Pencil size={14} /> Edit project</button><Link className="button button-primary" href={`/projects/${project.id}/brief`} data-testid="link-open-brief"><FileText size={14} /> Creative brief</Link></div></div>
        <div className="workspace-tabs"><button className={`tab ${view === 'tracks' ? 'active' : ''}`} onClick={() => setView('tracks')} data-testid="tab-tracks-view">Tracks view</button><button className={`tab ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')} data-testid="tab-reference-map">Reference map</button></div>
      </div>
      {view === 'tracks' ? <><div className="toolbar"><div className="search-wrap"><Search size={15} /><input className="input search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search references" aria-label="Search references" data-testid="input-search-references" /></div><button className="button button-primary" onClick={() => setModal('reference')} data-testid="button-add-reference"><Plus size={15} /> Add reference</button></div><div className="filter-list" style={{ marginBottom: 19 }}><button className={`filter ${filter === 'All' ? 'active' : ''}`} onClick={() => setFilter('All')} data-testid="filter-category-all">All</button>{categories.map((category) => <button key={category} className={`filter ${filter === category ? 'active' : ''}`} onClick={() => setFilter(category)} data-testid={`filter-category-${category.toLowerCase()}`}>{category}</button>)}</div>{filtered.length === 0 ? <div className="empty-state"><ListMusic size={27} /><h3>{project.references.length ? 'No references match.' : 'Build the reference shelf.'}</h3><p>{project.references.length ? 'Try a different search or category.' : 'Add a track, then capture the exact moments that explain what you hear.'}</p>{!project.references.length && <button className="button button-primary" onClick={() => setModal('reference')} data-testid="button-empty-add-reference"><Plus size={14} /> Add first reference</button>}</div> : <div className="reference-list">{filtered.map((reference) => <ReferenceRow key={reference.id} reference={reference} onOpen={() => setLocation(`/projects/${project.id}/references/${reference.id}`)} onEdit={() => { setEditingReference(reference); setModal('editReference'); }} onDelete={() => removeReference(reference)} />)}</div>}</> : <ReferenceMap references={project.references} markers={allMarkers}onOpen={(referenceId) => setLocation(`/projects/${project.id}/references/${referenceId}`)} />}
      {modal === 'reference' && <ReferenceModal onClose={() => setModal(null)} onSave={addReference} />}
      {modal === 'editReference' && <ReferenceModal initial={editingReference} onClose={() => { setModal(null); setEditingReference(undefined); }} onSave={editReference} />}
      {modal === 'edit' && <ProjectModal mode="edit" initial={project} onClose={() => setModal(null)} onSave={editProject} />}
    </div>
  );
}

function ReferenceRow({ reference, onOpen, onEdit, onDelete }: { reference: Reference; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  return <article className="reference-row" data-testid={`row-reference-${reference.id}`}><button className="cover" onClick={onOpen} data-testid={`button-open-reference-${reference.id}`}>{reference.artwork ? <img src={reference.artwork} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : initials(reference.title)}</button><button onClick={onOpen} style={{ textAlign: 'left', background: 'transparent', border: 0, color: 'inherit', minWidth: 0 }} data-testid={`button-reference-title-${reference.id}`}><div className="reference-title">{reference.title}</div><div className="reference-artist">{reference.artist}</div>{reference.notes && <div className="reference-notes">{reference.notes}</div>}<div className="reference-stats" style={{ marginTop: 9 }}><span><Zap size={13} /> {reference.markers.length} markers</span>{reference.url && <span><Link2 size={13} /> linked</span>}</div></button><div className="reference-row-actions"><button className="button button-ghost button-small" onClick={onOpen} data-testid={`button-listen-reference-${reference.id}`}><Play size={13} /> Open</button><button className="button button-ghost button-small" onClick={onEdit} data-testid={`button-edit-reference-${reference.id}`}><Pencil size={13} /></button><button className="button button-ghost button-small button-danger" onClick={onDelete} data-testid={`button-delete-reference-${reference.id}`}><Trash2 size={13} /></button></div></article>;
}

function ReferenceMap({ references, markers, onOpen }: { references: Reference[]; markers: { marker: Marker; reference: Reference }[]; onOpen: (id: string) => void }) {
  const [groupBy, setGroupBy] = useState<'track' | 'category'>('track');
  const columns = categories.map((category) => ({ category, markers: markers.filter(({ marker }) => marker.category === category) })).filter(({ markers: items }) => items.length);
  if (columns.length === 0) return <div className="empty-state"><SlidersHorizontal size={27} /><h3>Your map is waiting for markers.</h3><p>Open a reference and mark the moments you want to turn into direction.</p></div>;
  const toggle = <div className="map-group-toggle" role="group" aria-label="Group reference map">{(['track', 'category'] as const).map((value) => <button key={value} className={`filter ${groupBy === value ? 'active' : ''}`} onClick={() => setGroupBy(value)} aria-pressed={groupBy === value} data-testid={`button-map-group-${value}`}>By {value}</button>)}</div>;
  if (groupBy === 'track') {
    // `markers` is already category-filtered, so derive each track's list from it rather than from reference.markers.
    const tracks = references.map((reference, index) => ({ reference, index, markers: markers.filter((item) => item.reference.id === reference.id).map(({ marker }) => marker).sort((a, b) => a.timestamp - b.timestamp) }));
    return <>{toggle}<div className="map-tracks">{tracks.map(({ reference, index, markers: items }) => <section className="map-track" key={reference.id} data-testid={`section-map-track-${reference.id}`}><button className="map-track-head" onClick={() => onOpen(reference.id)} data-testid={`button-map-track-${reference.id}`}><span className="map-track-number">{(index + 1).toString().padStart(2, '0')}</span><span className="map-track-title"><strong>{reference.title}</strong><span>{reference.artist}</span></span><span className="map-track-count">{items.length} {items.length === 1 ? 'marker' : 'markers'}</span></button>{items.length === 0 ? <p className="map-track-empty">No markers here yet.</p> : <div className="map-track-markers">{items.map((marker) => <button className="map-marker" key={marker.id} onClick={() => onOpen(reference.id)} data-testid={`button-map-marker-${marker.id}`}><div className="map-track-marker-head"><span className="map-time">{formatTime(marker.timestamp)}</span><span className="category-pill">{marker.category}</span></div><div className="map-note">{marker.whatILike}</div></button>)}</div>}</section>)}</div></>;
  }
  return <>{toggle}<div className="map-grid">{columns.map(({ category, markers: items }) =><section className="map-column" key={category}><div className="map-column-head"><h3>{category}</h3><span>{items.length.toString().padStart(2, '0')}</span></div>{items.map(({ marker, reference }) => <button className="map-marker" key={marker.id} onClick={() => onOpen(reference.id)} style={{ width: '100%', background: 'transparent', border: 0, color: 'inherit', textAlign: 'left' }} data-testid={`button-map-marker-${marker.id}`}><div className="map-time">{formatTime(marker.timestamp)}</div><div className="map-song">{reference.title} <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>— {reference.artist}</span></div><div className="map-note">{marker.whatILike}</div></button>)}</section>)}</div></>;
}

function ReferencePlayer({ projects, setProjects, notify }: { projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>; notify: Notice }) {
  const { projectId, referenceId } = useParams<{ projectId: string; referenceId: string }>();
  const [, setLocation] = useLocation();
  const project = projects.find((item) => item.id === projectId);
  const reference = project?.references.find((item) => item.id === referenceId);
  const [currentTime, setCurrentTime] = useState(0);
  const [modal, setModal] = useState<'new' | Marker | null>(null);
  const confirm = useConfirm();
  const videoId = reference ? getYouTubeVideoId(reference.url) : null;
  const video = useYouTubePlayer(videoId);
  if (!project || !reference) return <Missing title="Reference not found" back={project ? `/projects/${project.id}` : '/'} />;
  // A YouTube link drives the timeline from the embedded player; otherwise the timeline is a manual marker-positioning aid
  // long enough for a typical track and for every existing marker.
  const useVideo = videoId !== null && video.status !== 'error';
  const manualDuration = Math.max(300, ...reference.markers.map((marker) => marker.timestamp + 30));
  const time = useVideo ? video.currentTime : currentTime;
  const total = useVideo ? Math.max(1, Math.floor(video.duration)) : manualDuration;
  const togglePlay = () => { if (video.playing) video.pause(); else video.play(); };
  const seek = (seconds: number) => { if (useVideo) video.seek(seconds); else setCurrentTime(seconds); };
  const openNewMarker = () => { if (useVideo) video.pause(); setModal('new'); };
  const updateReference = (next: Reference) => setProjects((items) => items.map((item) => item.id === project.id ? { ...item, references: item.references.map((ref) => ref.id === next.id ? next : ref), updatedAt: now() } : item));
  const saveMarker = (data: Omit<Marker, 'id' | 'createdAt'>) => {
    const current = typeof modal === 'object' ? modal : undefined;
    const marker: Marker = { ...data, id: current?.id || id(), createdAt: current?.createdAt || now() };
    updateReference({ ...reference, markers: current ? reference.markers.map((item) => item.id === current.id ? marker : item) : [...reference.markers, marker] });
    setModal(null); notify(current ? 'Marker updated' : `Marker added at ${formatTime(marker.timestamp)}`);
  };
  const deleteMarker = (marker: Marker) => confirm({
    title: 'Delete marker?', message: `The ${marker.category} marker at ${formatTime(marker.timestamp)} will be removed.`, confirmLabel: 'Delete marker',
    onConfirm: () => { updateReference({ ...reference, markers: reference.markers.filter((item) => item.id !== marker.id) }); notify('Marker deleted'); },
  });
  return (
    <div className="page">
      <Link href={`/projects/${project.id}`} className="crumb" data-testid="link-back-workspace"><ChevronLeft size={13} /> {project.title}</Link>
      <div className={`player-layout ${videoId ? 'has-video' : ''}`}>
        <div>{videoId ? <><div className="player-video" ref={video.containerRef} data-testid="player-youtube" />{video.status === 'loading' && <p className="player-video-note">Loading YouTube player…</p>}{video.status === 'error' && <p className="player-video-note">This video can’t be played here. Open it on YouTube and set marker times manually.</p>}</> : <div className="player-artwork">{reference.artwork ? <img src={reference.artwork} alt={`${reference.title} artwork`} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : initials(reference.title)}</div>}<div className="player-copy"><div className="eyebrow">Reference track</div><h1>{reference.title}</h1><p className="workspace-title-meta">{reference.artist}</p>{reference.url && <a className="external-link" href={reference.url} target="_blank" rel="noreferrer" data-testid="link-external-reference"><ArrowUpRight size={13} /> Open external link</a>}{reference.notes && <p className="subtle" style={{ marginTop: 23, fontSize: 12, maxWidth: 360 }}>{reference.notes}</p>}</div></div>
        <div className="player-panel"><div className="player-topline"><span className="section-label">Listen + mark</span><span className="section-label">{reference.markers.length} markers</span></div>{useVideo ? <button className="button button-secondary button-small" onClick={togglePlay} disabled={video.status !== 'ready'} data-testid="button-play-reference">{video.playing ? <Pause size={13} /> : <Play size={13} />}{video.playing ? 'Pause' : 'Play'}</button> : <p className="player-manual-note" data-testid="text-manual-timeline">{videoId ? 'Playback is unavailable for this video.' : 'No YouTube link on this reference.'} Listen in another tab, drag the timeline to the moment, then add a marker.</p>}<div className="timeline"><input aria-label="Reference timeline" type="range" min="0" max={total} step="1" value={Math.min(Math.floor(time), total)} disabled={useVideo && video.status !== 'ready'} onChange={(event) => seek(Number(event.target.value))} style={{ width: '100%', accentColor: 'hsl(var(--primary))' }} data-testid="input-reference-timeline" /><div className="timeline-times"><span>{formatTime(time)}</span><span>{formatTime(total)}</span></div></div><div className="quick-marker"><div className="input" style={{ display: 'flex', alignItems: 'center', padding: '0 11px', color: 'hsl(var(--primary))', fontFamily: 'var(--app-font-mono)', fontSize: 12 }}>{formatTime(time)}</div><button className="button button-primary" onClick={openNewMarker} data-testid="button-quick-add-marker"><Plus size={14} /> Add marker</button></div><div className="marker-list"><div className="section-label">Captured moments</div>{reference.markers.length === 0 ? <div className="empty-state" style={{ padding: '30px 15px', marginTop: 5 }}><Headphones size={20} /><h3>No moments yet</h3><p>Move the timeline to a useful moment and add your first note.</p></div> : reference.markers.slice().sort((a, b) => a.timestamp - b.timestamp).map((marker) => <MarkerCard key={marker.id} marker={marker} onSeek={useVideo && video.status === 'ready' ? () => seek(marker.timestamp) : undefined} onEdit={() => setModal(marker)} onDelete={() => deleteMarker(marker)} />)}</div></div>
      </div>
      {modal && <MarkerModal initial={typeof modal === 'object' ? modal : undefined} timestamp={Math.floor(time)} onClose={() => setModal(null)} onSave={saveMarker} />}
    </div>
  );
}

function MarkerCard({ marker, onSeek, onEdit, onDelete }: { marker: Marker; onSeek?: () => void; onEdit: () => void; onDelete: () => void }) {
  return <article className="marker-card" data-testid={`card-marker-${marker.id}`}><div className="marker-head"><div>{onSeek ? <button className="marker-time marker-seek" onClick={onSeek} aria-label={`Jump to ${formatTime(marker.timestamp)}`} data-testid={`button-seek-marker-${marker.id}`}>{formatTime(marker.timestamp)}</button> : <span className="marker-time">{formatTime(marker.timestamp)}</span>}<span style={{ color: 'hsl(var(--border))', margin: '0 8px' }}>·</span><span className="category-pill">{marker.category}</span></div><div className="marker-actions"><button className="icon-button" onClick={onEdit} aria-label="Edit marker" data-testid={`button-edit-marker-${marker.id}`}><Pencil size={14} /></button><button className="icon-button" onClick={onDelete} aria-label="Delete marker" data-testid={`button-delete-marker-${marker.id}`}><Trash2 size={14} /></button></div></div><div className="marker-main"><div><div className="marker-field-label">What I like</div><div className="marker-field-value">{marker.whatILike}</div></div><div><div className="marker-field-label">How I want to use it</div><div className="marker-field-value">{marker.howIWantToUseIt}</div></div></div></article>;
}

function Brief({ projects, notify }: { projects: Project[]; notify: Notice }) {
  const { projectId } = useParams<{ projectId: string }>();
  const project = projects.find((item) => item.id === projectId);
  const [, setLocation] = useLocation();
  if (!project) return <Missing title="Project not found" back="/" />;
  const markers = project.references.flatMap((reference) => reference.markers.map((marker) => ({ marker, reference }))).sort((a, b) => a.marker.timestamp - b.marker.timestamp);
  const briefText = `${project.title.toUpperCase()}\n${project.artist || 'Creative brief'}\n\n${markers.map(({ marker, reference }) => `[${marker.category}] ${reference.title} — ${formatTime(marker.timestamp)}\nWhat I like: ${marker.whatILike}\nHow I want to use it: ${marker.howIWantToUseIt}`).join('\n\n')}`;
  const writeBrief = async () => {
    try { await navigator.clipboard.writeText(briefText); return true; } catch { return false; }
  };
  const copy = async () => { if (await writeBrief()) notify('Creative brief copied'); else notify('Could not copy — clipboard access is blocked', 'error'); };
  const share = async () => {
    if ('share' in navigator) {
      try { await navigator.share({ title: `${project.title} — Creative Brief`, text: briefText }); notify('Creative brief shared'); return; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; /* other failures fall back to copy */ }
    }
    if (await writeBrief()) notify('Brief copied for sharing'); else notify('Could not share or copy the brief', 'error');
  };
  return <div className="page"><Link href={`/projects/${project.id}`} className="crumb" data-testid="link-back-brief"><ChevronLeft size={13} /> {project.title}</Link><div className="brief-header"><div><div className="eyebrow">Direction / Export</div><h1>Creative Brief</h1><p className="brief-meta">{project.artist || 'Untitled project'} · {markers.length} captured moments · edited {formatDate(project.updatedAt)}</p></div><div className="brief-actions"><button className="button button-secondary" onClick={copy} data-testid="button-copy-brief"><Copy size={14} /> Copy brief</button><button className="button button-primary" onClick={share} data-testid="button-share-brief"><Share2 size={14} /> Share</button></div></div>{markers.length === 0 ? <div className="empty-state"><FileText size={28} /><h3>The brief will take shape here.</h3><p>Capture a few moments in your references. Each one becomes a clear, usable direction.</p><button className="button button-primary" onClick={() => setLocation(`/projects/${project.id}`)} data-testid="button-brief-add-markers">Back to references</button></div> : <div className="brief-wrap"><div className="brief-columns"><div className="brief-column-title">Category</div><div className="brief-column-title">Reference</div><div className="brief-column-title">What I like</div><div className="brief-column-title">How I want to use it</div>{markers.map(({ marker, reference }) => <div className="brief-row" key={marker.id}><div className="brief-cell"><span className="category-pill">{marker.category}</span><div style={{ color: 'hsl(var(--primary))', marginTop: 9 }}>{formatTime(marker.timestamp)}</div></div><div className="brief-cell"><div className="brief-song">{reference.title}</div><div className="brief-artist">{reference.artist}</div></div><div className="brief-cell">{marker.whatILike}</div><div className="brief-cell">{marker.howIWantToUseIt}</div></div>)}</div></div>}</div>;
}

function SettingsPage({ projects, setProjects, notify }: { projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>; notify: Notice }) {
  const confirm = useConfirm();
  const demo = seedProjects()[0];
  const hasDemo = projects.some((project) => project.id === demo.id);
  const loadDemo = () => {
    const apply = () => { setProjects((items) => [demo, ...items.filter((item) => item.id !== demo.id)]); notify(hasDemo ? 'Demo project restored' : 'Demo project added'); };
    if (!hasDemo) { apply(); return; }
    confirm({ title: 'Restore demo project?', message: `“${demo.title}” will be reset to its original references and markers. Your other projects are not affected.`, confirmLabel: 'Restore demo', onConfirm: apply });
  };
  const clearAll = () => confirm({
    title: 'Delete all projects?', message: `All ${projects.length} ${projects.length === 1 ? 'project' : 'projects'} will be removed from this browser. You can add the demo project again afterwards.`, confirmLabel: 'Delete everything',
    onConfirm: () => { setProjects([]); notify('All projects deleted'); },
  });
  return <div className="page"><div className="page-header"><div><div className="eyebrow">RefMap / Preferences</div><h1>Settings</h1><p className="subtle" style={{ marginTop: 12 }}>A few notes about how this little room works.</p></div></div><div className="settings-layout"><nav className="settings-nav"><span>About RefMap</span></nav><div>
    <section className="settings-block"><h3>Built for the listening part</h3><p>RefMap is a quiet workspace for the references that shape a record. It keeps the exact moment, the reason it matters, and the next creative move together.</p></section>
    <section className="settings-block"><h3>Local by default</h3><p>Your projects, references, and markers are stored in this browser using local storage. Nothing is sent to a server; YouTube videos stream from YouTube when you open a reference. Export your Creative Brief when you are ready to share direction with a collaborator.</p><div className="status-line"><span className="status-dot" /> Local persistence is active</div></section>
    <section className="settings-block"><h3>Demo data</h3><p>{hasDemo ? `The “${demo.title}” demo project is in your workspace. Restore it to undo any changes you made to it.` : `Add the “${demo.title}” demo project: three YouTube references with markers ready to explore.`}</p><div className="settings-actions"><button className="button button-secondary" onClick={loadDemo} data-testid="button-load-demo">{hasDemo ? 'Restore demo project' : 'Add demo project'}</button><button className="button button-ghost button-danger" onClick={clearAll} disabled={projects.length === 0} data-testid="button-clear-projects"><Trash2 size={14} /> Delete all projects</button></div></section>
    <section className="settings-block"><h3>RefMap</h3><p>Version 1.0 · A session notebook for artists, producers, and engineers.</p></section>
  </div></div></div>;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}

function ProjectModal({ mode, initial, onClose, onSave }: { mode: 'new' | 'edit'; initial?: Project; onClose: () => void; onSave: (data: Pick<Project, 'title' | 'artist' | 'description'>) => void }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [artist, setArtist] = useState(initial?.artist || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [error, setError] = useState('');
  useEffect(() => { setTitle(initial?.title || ''); setArtist(initial?.artist || ''); setDescription(initial?.description || ''); }, [initial?.id]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) { setError('Give the project a title.'); return; } onSave({ title: title.trim(), artist: artist.trim(), description: description.trim() }); };
  return <Modal title={mode === 'new' ? 'New project' : 'Edit project'} onClose={onClose}><form onSubmit={submit} noValidate><div className="form-grid"><div><label className="form-label" htmlFor="project-title">Project title</label><input id="project-title" className="input" autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} aria-invalid={!!error} placeholder="e.g. Night Transit" data-testid="input-project-title" /><FieldError message={error} /></div><div><label className="form-label" htmlFor="project-artist">Artist / project name</label><input id="project-artist" className="input" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Who is this for?" data-testid="input-project-artist" /></div><div><label className="form-label" htmlFor="project-description">Description</label><textarea id="project-description" className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you trying to make?" data-testid="input-project-description" /></div></div><div className="modal-footer"><button type="button" className="button button-secondary" onClick={onClose} data-testid="button-cancel-project">Cancel</button><button type="submit" className="button button-primary" data-testid="button-save-project"><Check size={14} /> {mode === 'new' ? 'Create project' : 'Save changes'}</button></div></form></Modal>;
}

function ReferenceModal({ initial, onClose, onSave }: { initial?: Reference; onClose: () => void; onSave: (data: Omit<Reference, 'id' | 'markers'>) => void }) {
  const [title, setTitle] = useState(initial?.title || ''); const [artist, setArtist] = useState(initial?.artist || ''); const [url, setUrl] = useState(initial?.url || ''); const [artwork, setArtwork] = useState(initial?.artwork || ''); const [notes, setNotes] = useState(initial?.notes || '');
  const [errors, setErrors] = useState<Partial<Record<'title' | 'artist' | 'url' | 'artwork', string>>>({});
  useEffect(() => { setTitle(initial?.title || ''); setArtist(initial?.artist || ''); setUrl(initial?.url || ''); setArtwork(initial?.artwork || ''); setNotes(initial?.notes || ''); }, [initial?.id]);
  const clearError = (field: keyof typeof errors) => setErrors(({ [field]: _, ...rest }) => rest);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Add the song title.';
    if (!artist.trim()) next.artist = 'Add the artist.';
    if (url.trim() && !isHttpUrl(url.trim())) next.url = 'Enter a full link starting with https://';
    if (artwork.trim() && !isHttpUrl(artwork.trim())) next.artwork = 'Enter a full image link starting with https://';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave({ title: title.trim(), artist: artist.trim(), url: url.trim(), artwork: artwork.trim(), notes: notes.trim() });
  };
  const youTubeHint = url.trim() && isHttpUrl(url.trim()) ? (getYouTubeVideoId(url) ? 'YouTube video detected — it will play inside RefMap.' : 'Not a YouTube video link — it will open in a new tab instead.') : 'YouTube links play inside RefMap so you can mark moments while you listen.';
  return <Modal title={initial ? 'Edit reference' : 'Add reference'} onClose={onClose}><form onSubmit={submit} noValidate><div className="form-grid"><div><label className="form-label" htmlFor="reference-title">Song title</label><input id="reference-title" className="input" autoFocus value={title} onChange={(event) => { setTitle(event.target.value); clearError('title'); }} aria-invalid={!!errors.title} placeholder="A moment worth returning to" data-testid="input-reference-title" /><FieldError message={errors.title} /></div><div><label className="form-label" htmlFor="reference-artist">Artist</label><input id="reference-artist" className="input" value={artist} onChange={(event) => { setArtist(event.target.value); clearError('artist'); }} aria-invalid={!!errors.artist} placeholder="Artist name" data-testid="input-reference-artist" /><FieldError message={errors.artist} /></div><div><label className="form-label" htmlFor="reference-url">External URL <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label><input id="reference-url" className="input" type="url" value={url} onChange={(event) => { setUrl(event.target.value); clearError('url'); }} aria-invalid={!!errors.url} placeholder="https://youtube.com/watch?v=…" data-testid="input-reference-url" />{errors.url ? <FieldError message={errors.url} /> : <p className="form-hint" data-testid="text-url-hint">{youTubeHint}</p>}</div><div><label className="form-label" htmlFor="reference-artwork">Artwork URL <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label><input id="reference-artwork" className="input" type="url" value={artwork} onChange={(event) => { setArtwork(event.target.value); clearError('artwork'); }} aria-invalid={!!errors.artwork} placeholder="https://" data-testid="input-reference-artwork" /><FieldError message={errors.artwork} /></div><div><label className="form-label" htmlFor="reference-notes">Why is it here?</label><textarea id="reference-notes" className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="The feeling, move, or detail to listen for." data-testid="input-reference-notes" /></div></div><div className="modal-footer"><button type="button" className="button button-secondary" onClick={onClose} data-testid="button-cancel-reference">Cancel</button><button type="submit" className="button button-primary" data-testid="button-save-reference"><Check size={14} /> {initial ? 'Save changes' : 'Add reference'}</button></div></form></Modal>;
}

function MarkerModal({ initial, timestamp, onClose, onSave }: { initial?: Marker; timestamp: number; onClose: () => void; onSave: (data: Omit<Marker, 'id' | 'createdAt'>) => void }) {
  const [time, setTime] = useState(initial ? formatTime(initial.timestamp) : formatTime(timestamp)); const [category, setCategory] = useState<Category>(initial?.category || 'Mood'); const [whatILike, setWhatILike] = useState(initial?.whatILike || ''); const [howIWantToUseIt, setHowIWantToUseIt] = useState(initial?.howIWantToUseIt || '');
  const [errors, setErrors] = useState<Partial<Record<'time' | 'like' | 'use', string>>>({});
  const clearError = (field: keyof typeof errors) => setErrors(({ [field]: _, ...rest }) => rest);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const seconds = parseTime(time);
    const next: typeof errors = {};
    if (seconds === null) next.time = 'Use minutes:seconds, e.g. 1:32.';
    if (!whatILike.trim()) next.like = 'Describe what you hear.';
    if (!howIWantToUseIt.trim()) next.use = 'Say how you want to use it.';
    setErrors(next);
    if (seconds === null || Object.keys(next).length) return;
    onSave({ timestamp: seconds, category, whatILike: whatILike.trim(), howIWantToUseIt: howIWantToUseIt.trim() });
  };
  return <Modal title={initial ? 'Edit marker' : 'Capture a moment'} onClose={onClose}><form onSubmit={submit} noValidate><div className="form-grid"><div><label className="form-label" htmlFor="marker-time">Timestamp</label><input id="marker-time" className="input" value={time} onChange={(event) => { setTime(event.target.value); clearError('time'); }} aria-invalid={!!errors.time} placeholder="1:32" data-testid="input-marker-timestamp" /><FieldError message={errors.time} /></div><div><label className="form-label" htmlFor="marker-category">Creative category</label><select id="marker-category" className="select" value={category} onChange={(event) => setCategory(event.target.value as Category)} data-testid="select-marker-category">{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className="form-label" htmlFor="marker-like">What I like</label><textarea id="marker-like" className="textarea" autoFocus={!initial} value={whatILike} onChange={(event) => { setWhatILike(event.target.value); clearError('like'); }} aria-invalid={!!errors.like} placeholder="Name the exact thing you hear." data-testid="input-marker-like" /><FieldError message={errors.like} /></div><div><label className="form-label" htmlFor="marker-use">How I want to use it</label><textarea id="marker-use" className="textarea" value={howIWantToUseIt} onChange={(event) => { setHowIWantToUseIt(event.target.value); clearError('use'); }} aria-invalid={!!errors.use} placeholder="Translate the instinct into a move for this record." data-testid="input-marker-use" /><FieldError message={errors.use} /></div></div><div className="modal-footer"><button type="button" className="button button-secondary" onClick={onClose} data-testid="button-cancel-marker">Cancel</button><button type="submit" className="button button-primary" data-testid="button-save-marker"><Check size={14} /> {initial ? 'Save marker' : 'Capture marker'}</button></div></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog" data-testid="button-close-modal"><X size={17} /></button></div><div className="modal-body">{children}</div></div></div>;
}

function Missing({ title, back }: { title: string; back: string }) {
  return <div className="page"><div className="empty-state"><Disc3 size={29} /><h3>{title}</h3><p>The thing you are looking for may have moved or been deleted.</p><Link href={back} className="button button-primary" data-testid="link-missing-back"><ArrowLeft size={14} /> Go back</Link></div></div>;
}

function NotFound() {
  return <Missing title="Page not found" back="/" />;
}

export default App;