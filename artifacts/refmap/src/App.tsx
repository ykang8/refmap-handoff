import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Timeline } from '@/components/timeline';
import {
  ArrowUpRight, Check, ChevronRight, Copy, Disc3, FileAudio, FileText, Link2, ListMusic,
  MonitorPlay, Music2, Pause, Pencil, Play, Plus, Search, Share2, SlidersHorizontal, Trash2, Upload, X,
} from 'lucide-react';
import {
  Link, Route, Switch, useLocation, useParams, Router as WouterRouter,
} from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { useYouTubePlayer } from '@/hooks/use-youtube-player';
import { clearAudio, deleteAudio, formatBytes, maxAudioBytes, putAudio, validateAudioFile } from '@/lib/audio-store';
import { getYouTubeVideoId } from '@/lib/youtube';

type Category = 'Vocal' | 'Drums' | 'Bass' | 'Guitar' | 'Instruments' | 'Arrangement' | 'Mix' | 'Mood' | 'Other';
type Project = { id: string; title: string; artist: string; description: string; references: Reference[]; createdAt: string; updatedAt: string };
/** `audio` describes an uploaded file; the file itself is stored in IndexedDB under the reference id. */
type AudioMeta = { name: string; size: number; type: string };
type Reference = { id: string; title: string; artist: string; url: string; artwork: string; notes: string; markers: Marker[]; audio?: AudioMeta };
type ReferenceInput = Omit<Reference, 'id' | 'markers'>;
type Marker = { id: string; timestamp: number; category: Category; whatILike: string; howIWantToUseIt: string; createdAt: string };
type SetProjects = React.Dispatch<React.SetStateAction<Project[]>>;
type Notice = (message: string, tone?: 'success' | 'error') => void;
type ConfirmRequest = { title: string; message: string; confirmLabel: string; onConfirm: () => void };
const ConfirmContext = createContext<(request: ConfirmRequest) => void>(() => undefined);
const useConfirm = () => useContext(ConfirmContext);
const categories: Category[] = ['Vocal', 'Drums', 'Bass', 'Guitar', 'Instruments', 'Arrangement', 'Mix', 'Mood', 'Other'];
const categoryColors: Record<Category, string> = {
  Vocal: '#f06595', Drums: '#ff922b', Bass: '#9775fa', Guitar: '#fcc419', Instruments: '#20c997',
  Arrangement: '#4dabf7', Mix: '#94d82d', Mood: '#e599f7', Other: '#adb5bd',
};
const storageKey = 'refmap-projects-v1';
const audioAccept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm,.aif,.aiff';

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
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const markerCount = (project: Project) => project.references.reduce((sum, reference) => sum + reference.markers.length, 0);
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

type SourceKind = 'audio' | 'youtube' | 'link' | 'none';
const sourceOf = (reference: Reference): SourceKind => reference.audio ? 'audio' : getYouTubeVideoId(reference.url) ? 'youtube' : reference.url ? 'link' : 'none';
const sourceLabels: Record<SourceKind, string> = { audio: 'Audio file', youtube: 'YouTube', link: 'Link', none: 'No source' };

// Set by the Reference map so the player opens at the clicked marker.
let pendingSeek: { referenceId: string; time: number } | null = null;

// Demo data. Videos are official uploads checked to play in an embedded player; marker times are illustrative and stay within each video's length.
const youTubeThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
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
  return (
    <Modal title={request.title} onClose={onClose} size="small">
      <p className="confirm-message">{request.message}</p>
      <div className="modal-footer">
        <button className="button" onClick={onClose} autoFocus data-testid="button-confirm-cancel">Cancel</button>
        <button className="button button-danger" onClick={() => { request.onConfirm(); onClose(); }} data-testid="button-confirm-ok">{request.confirmLabel}</button>
      </div>
    </Modal>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

/* ---------- Shared pieces ---------- */

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const onProjects = location === '/' || location.startsWith('/projects');
  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand" data-testid="link-brand"><BrandMark /> RefMap</Link>
        <nav className="topnav" aria-label="Main navigation">
          <Link href="/" className={onProjects ? 'active' : ''} data-testid="link-nav-projects">Projects</Link>
          <Link href="/settings" className={location === '/settings' ? 'active' : ''} data-testid="link-nav-settings">Settings</Link>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 20 20" aria-hidden="true">
      {[[2, 8], [6, 4], [10, 1], [14, 5], [18, 9]].map(([x, y]) => <rect key={x} x={x - 1.25} y={y} width="2.5" height={20 - y * 2} rx="1.25" />)}
    </svg>
  );
}

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={index} className="breadcrumb">
          {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
          {item.href ? <Link href={item.href} data-testid={`link-breadcrumb-${index}`}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

function PageHeader({ title, meta, description, actions }: { title: string; meta?: ReactNode; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="page-heading">
        <h1>{title}</h1>
        {meta && <p className="page-meta">{meta}</p>}
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Music2; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <Icon size={22} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

function Cover({ reference, size = 'small' }: { reference: Reference; size?: 'small' | 'large' }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`cover cover-${size}`} aria-hidden="true">
      {reference.artwork && !failed
        // YouTube's 16:9 "mq" thumbnail has no letterbox bars, unlike the 4:3 "hq" one.
        ? <img src={reference.artwork.replace(/(i\.ytimg\.com\/vi\/[^/]+\/)hqdefault\.jpg$/, '$1mqdefault.jpg')} alt="" onError={() => setFailed(true)} />
        : sourceOf(reference) === 'audio' ? <FileAudio size={size === 'large' ? 40 : 18} /> : initials(reference.title)}
    </span>
  );
}

function SourceBadge({ reference }: { reference: Reference }) {
  const kind = sourceOf(reference);
  const Icon = { audio: FileAudio, youtube: MonitorPlay, link: Link2, none: Disc3 }[kind];
  return <span className={`source-badge source-${kind}`}><Icon size={12} aria-hidden="true" />{sourceLabels[kind]}</span>;
}

function CategoryChip({ category }: { category: Category }) {
  return <span className="chip" style={{ '--c': categoryColors[category] } as CSSProperties}><i aria-hidden="true" />{category}</span>;
}

function CategoryFilter({ value, onChange }: { value: 'All' | Category; onChange: (value: 'All' | Category) => void }) {
  return (
    <div className="filter-row" role="group" aria-label="Filter by category">
      <button className={`filter ${value === 'All' ? 'active' : ''}`} onClick={() => onChange('All')} aria-pressed={value === 'All'} data-testid="filter-category-all">All</button>
      {categories.map((category) => (
        <button key={category} className={`filter ${value === category ? 'active' : ''}`} style={{ '--c': categoryColors[category] } as CSSProperties} onClick={() => onChange(category)} aria-pressed={value === category} data-testid={`filter-category-${category.toLowerCase()}`}>
          <i aria-hidden="true" />{category}
        </button>
      ))}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; testId?: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" className={value === option.value ? 'active' : ''} aria-pressed={value === option.value} onClick={() => onChange(option.value)} data-testid={option.testId}>{option.label}</button>
      ))}
    </div>
  );
}

function IconButton({ label, onClick, children, danger, testId }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; testId?: string }) {
  return <button type="button" className={`icon-button ${danger ? 'icon-button-danger' : ''}`} onClick={onClick} aria-label={label} title={label} data-testid={testId}>{children}</button>;
}

/* ---------- Projects ---------- */

function Dashboard({ projects, setProjects, notify }: { projects: Project[]; setProjects: SetProjects; notify: Notice }) {
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
    onConfirm: () => {
      setProjects((items) => items.filter((item) => item.id !== project.id));
      deleteAudio(project.references.filter((reference) => reference.audio).map((reference) => reference.id));
      notify('Project deleted');
    },
  });
  const newButton = <button className="button button-primary" onClick={() => setModal('new')} data-testid="button-new-project"><Plus size={15} /> New project</button>;
  return (
    <div className="page">
      <PageHeader title="Projects" meta={projects.length ? plural(projects.length, 'project') : undefined} actions={projects.length ? newButton : undefined} />
      {projects.length === 0
        ? <EmptyState icon={Music2} title="No projects yet" body="A project collects the reference tracks for one song or record." action={newButton} />
        : (
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id} data-testid={`card-project-${project.id}`}>
                <Link href={`/projects/${project.id}`} className="project-card-link" data-testid={`button-open-project-${project.id}`}>
                  <ProjectCover project={project} />
                  <span className="project-card-body">
                    <strong>{project.title}</strong>
                    <span className="muted">{project.artist || 'No artist'}</span>
                    <span className="project-card-meta">{plural(project.references.length, 'reference')} · {plural(markerCount(project), 'marker')}</span>
                  </span>
                </Link>
                <div className="project-card-footer">
                  <span>Edited {formatDate(project.updatedAt)}</span>
                  <span className="row-actions">
                    <IconButton label={`Edit ${project.title}`} onClick={() => { setEditing(project); setModal('edit'); }} testId={`button-edit-project-${project.id}`}><Pencil size={15} /></IconButton>
                    <IconButton label={`Delete ${project.title}`} onClick={() => remove(project)} danger testId={`button-delete-project-${project.id}`}><Trash2 size={15} /></IconButton>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      {modal && <ProjectModal mode={modal} initial={modal === 'edit' ? editing : undefined} onClose={() => { setModal(null); setEditing(undefined); }} onSave={modal === 'new' ? create : update} />}
    </div>
  );
}

function ProjectCover({ project }: { project: Project }) {
  const tiles = project.references.slice(0, 4);
  if (tiles.length === 0) return <span className="project-cover project-cover-empty" aria-hidden="true">{initials(project.title)}</span>;
  return <span className={`project-cover tiles-${tiles.length}`} aria-hidden="true">{tiles.map((reference) => <Cover key={reference.id} reference={reference} />)}</span>;
}

/* ---------- Project workspace ---------- */

function Workspace({ projects, setProjects, notify }: { projects: Project[]; setProjects: SetProjects; notify: Notice }) {
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
  // Functional updates by id, because saving an uploaded file is async and `project` may be stale afterwards.
  const updateReferences = (change: (references: Reference[]) => Reference[]) => setProjects((items) => items.map((item) => item.id === project.id ? { ...item, references: change(item.references), updatedAt: now() } : item));
  const addReference = async (data: ReferenceInput, file: File | null) => {
    const referenceId = id();
    if (file) await putAudio(referenceId, file);
    updateReferences((references) => [...references, { ...data, id: referenceId, markers: [] }]);
    setModal(null); notify('Reference added');
  };
  const editReference = async (data: ReferenceInput, file: File | null) => {
    const target = editingReference;
    if (!target) return;
    if (file) await putAudio(target.id, file);
    updateReferences((references) => references.map((item) => item.id === target.id ? { ...item, ...data } : item));
    if (target.audio && !data.audio) deleteAudio([target.id]);
    setModal(null); setEditingReference(undefined); notify('Reference saved');
  };
  const editProject = (data: Pick<Project, 'title' | 'artist' | 'description'>) => {
    setProjects((items) => items.map((item) => item.id === project.id ? { ...item, ...data, updatedAt: now() } : item));
    setModal(null); notify('Project details saved');
  };
  const removeReference = (reference: Reference) => confirm({
    title: 'Remove reference?', message: `“${reference.title}” and its ${plural(reference.markers.length, 'marker')} will be removed from this project.${reference.audio ? ' The uploaded audio file is deleted too.' : ''}`, confirmLabel: 'Remove reference',
    onConfirm: () => {
      updateReferences((references) => references.filter((item) => item.id !== reference.id));
      if (reference.audio) deleteAudio([reference.id]);
      notify('Reference removed');
    },
  });
  const term = search.trim().toLowerCase();
  const filtered = project.references.filter((reference) => {
    const text = [reference.title, reference.artist, reference.notes, ...reference.markers.flatMap((marker) => [marker.whatILike, marker.howIWantToUseIt])].join(' ').toLowerCase();
    return (!term || text.includes(term)) && (filter === 'All' || reference.markers.some((marker) => marker.category === filter));
  });
  const allMarkers = project.references.flatMap((reference) => reference.markers.map((marker) => ({ marker, reference }))).filter(({ marker }) => filter === 'All' || marker.category === filter);
  const open = (referenceId: string) => setLocation(`/projects/${project.id}/references/${referenceId}`);
  const addButton = <button className="button button-primary" onClick={() => setModal('reference')} data-testid="button-add-reference"><Plus size={15} /> Add reference</button>;
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Projects', href: '/' }, { label: project.title }]} />
      <PageHeader
        title={project.title}
        meta={<>{project.artist || 'No artist'} · {plural(project.references.length, 'reference')} · {plural(markerCount(project), 'marker')}</>}
        description={project.description}
        actions={<>
          <button className="button" onClick={() => setModal('edit')} data-testid="button-edit-workspace"><Pencil size={14} /> Edit</button>
          <Link className="button" href={`/projects/${project.id}/brief`} data-testid="link-open-brief"><FileText size={14} /> Creative brief</Link>
          {addButton}
        </>}
      />
      <div className="toolbar">
        <Segmented<typeof view> label="View" value={view} onChange={setView} options={[{ value: 'tracks', label: 'Tracks', testId: 'tab-tracks-view' }, { value: 'map', label: 'Map', testId: 'tab-reference-map' }]} />
        {view === 'tracks' && project.references.length > 0 && (
          <label className="search">
            <Search size={15} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles and notes" aria-label="Search references" data-testid="input-search-references" />
          </label>
        )}
      </div>
      {project.references.length > 0 && <CategoryFilter value={filter} onChange={setFilter} />}
      {project.references.length === 0
        ? <EmptyState icon={ListMusic} title="No references yet" body="Add a YouTube link or upload an audio file, then mark the moments you want to remember." action={<button className="button button-primary" onClick={() => setModal('reference')} data-testid="button-empty-add-reference"><Plus size={15} /> Add reference</button>} />
        : view === 'tracks'
          ? filtered.length === 0
            ? <EmptyState icon={Search} title="No matches" body="Try a different search or category." />
            : (
              <div className="track-list">
                {filtered.map((reference) => <TrackRow key={reference.id} index={project.references.indexOf(reference) + 1} reference={reference} onOpen={() => open(reference.id)} onEdit={() => { setEditingReference(reference); setModal('editReference'); }} onDelete={() => removeReference(reference)} />)}
              </div>
            )
          : <ReferenceMap references={project.references} markers={allMarkers} filtered={filter !== 'All'} onOpen={(referenceId, time) => { pendingSeek = time === undefined ? null : { referenceId, time }; open(referenceId); }} />}
      {modal === 'reference' && <ReferenceModal onClose={() => setModal(null)} onSave={addReference} />}
      {modal === 'editReference' && <ReferenceModal initial={editingReference} onClose={() => { setModal(null); setEditingReference(undefined); }} onSave={editReference} />}
      {modal === 'edit' && <ProjectModal mode="edit" initial={project} onClose={() => setModal(null)} onSave={editProject} />}
    </div>
  );
}

function TrackRow({ index, reference, onOpen, onEdit, onDelete }: { index: number; reference: Reference; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const counts = categories.map((category) => ({ category, count: reference.markers.filter((marker) => marker.category === category).length })).filter(({ count }) => count);
  return (
    <div className="track-row" data-testid={`row-reference-${reference.id}`}>
      <button className="track-main" onClick={onOpen} data-testid={`button-open-reference-${reference.id}`}>
        <span className="track-index">{index}</span>
        <Cover reference={reference} />
        <span className="track-title"><strong>{reference.title}</strong><span>{reference.artist}</span></span>
        <SourceBadge reference={reference} />
        <span className="track-markers" title={counts.map(({ category, count }) => `${category}: ${count}`).join(', ') || 'No markers'}>
          <span className="dot-stack" aria-hidden="true">{counts.map(({ category }) => <i key={category} style={{ background: categoryColors[category] }} />)}</span>
          {plural(reference.markers.length, 'marker')}
        </span>
      </button>
      <span className="row-actions">
        <IconButton label={`Edit ${reference.title}`} onClick={onEdit} testId={`button-edit-reference-${reference.id}`}><Pencil size={15} /></IconButton>
        <IconButton label={`Remove ${reference.title}`} onClick={onDelete} danger testId={`button-delete-reference-${reference.id}`}><Trash2 size={15} /></IconButton>
      </span>
    </div>
  );
}

function ReferenceMap({ references, markers, filtered, onOpen }: { references: Reference[]; markers: { marker: Marker; reference: Reference }[]; filtered: boolean; onOpen: (referenceId: string, time?: number) => void }) {
  const [groupBy, setGroupBy] = useState<'track' | 'category'>('track');
  if (markers.length === 0) return <EmptyState icon={SlidersHorizontal} title={filtered ? 'No markers in this category' : 'No markers yet'} body={filtered ? 'Choose another category or All.' : 'Open a reference and add markers while you listen.'} />;
  const toggle = <Segmented<typeof groupBy> label="Group map" value={groupBy} onChange={setGroupBy} options={[{ value: 'track', label: 'By track', testId: 'button-map-group-track' }, { value: 'category', label: 'By category', testId: 'button-map-group-category' }]} />;
  const markerButton = (marker: Marker, reference: Reference, showSong: boolean) => (
    <button className="map-marker" key={marker.id} onClick={() => onOpen(reference.id, marker.timestamp)} style={{ '--c': categoryColors[marker.category] } as CSSProperties} data-testid={`button-map-marker-${marker.id}`}>
      <span className="map-marker-head"><span className="time">{formatTime(marker.timestamp)}</span>{showSong ? <span className="map-song">{reference.title}</span> : <CategoryChip category={marker.category} />}</span>
      <span className="map-note">{marker.whatILike}</span>
    </button>
  );
  if (groupBy === 'track') {
    // `markers` is already category-filtered, so derive each track's list from it rather than from reference.markers.
    const tracks = references.map((reference, index) => ({ reference, index, items: markers.filter((item) => item.reference.id === reference.id).map(({ marker }) => marker).sort((a, b) => a.timestamp - b.timestamp) }));
    return (
      <>
        <div className="map-controls">{toggle}</div>
        <div className="map-tracks">
          {tracks.map(({ reference, index, items }) => (
            <section className="map-track" key={reference.id} data-testid={`section-map-track-${reference.id}`}>
              <button className="map-track-head" onClick={() => onOpen(reference.id)} data-testid={`button-map-track-${reference.id}`}>
                <span className="track-index">{index + 1}</span>
                <Cover reference={reference} />
                <span className="track-title"><strong>{reference.title}</strong><span>{reference.artist}</span></span>
                <span className="muted">{plural(items.length, 'marker')}</span>
              </button>
              {items.length === 0 ? <p className="map-track-empty">{filtered ? 'No markers in this category.' : 'No markers yet.'}</p> : <div className="map-markers">{items.map((marker) => markerButton(marker, reference, false))}</div>}
            </section>
          ))}
        </div>
      </>
    );
  }
  const columns = categories.map((category) => ({ category, items: markers.filter(({ marker }) => marker.category === category) })).filter(({ items }) => items.length);
  return (
    <>
      <div className="map-controls">{toggle}</div>
      <div className="map-columns">
        {columns.map(({ category, items }) => (
          <section className="map-column" key={category}>
            <div className="map-column-head"><CategoryChip category={category} /><span className="muted">{items.length}</span></div>
            {items.map(({ marker, reference }) => markerButton(marker, reference, true))}
          </section>
        ))}
      </div>
    </>
  );
}

/* ---------- Reference player ---------- */

function ReferencePlayer({ projects, setProjects, notify }: { projects: Project[]; setProjects: SetProjects; notify: Notice }) {
  const { projectId, referenceId } = useParams<{ projectId: string; referenceId: string }>();
  const project = projects.find((item) => item.id === projectId);
  const reference = project?.references.find((item) => item.id === referenceId);
  const [manualTime, setManualTime] = useState(0);
  const [modal, setModal] = useState<'new' | Marker | null>(null);
  const [audioVersion, setAudioVersion] = useState(0);
  const confirm = useConfirm();
  const kind = reference ? sourceOf(reference) : 'none';
  const videoId = reference && kind === 'youtube' ? getYouTubeVideoId(reference.url) : null;
  const audio = useAudioPlayer(reference && kind === 'audio' ? reference.id : null, audioVersion);
  const video = useYouTubePlayer(videoId);
  // One transport for whichever source is playable; without one, the timeline is a manual marker-positioning aid.
  const engine = kind === 'audio' && audio.status === 'ready' ? audio : kind === 'youtube' && video.status === 'ready' ? video : null;
  const loading = (kind === 'audio' && audio.status === 'loading') || (kind === 'youtube' && video.status === 'loading');
  const manualDuration = Math.max(300, ...(reference?.markers ?? []).map((marker) => marker.timestamp + 30));
  const time = engine ? engine.currentTime : manualTime;
  const total = engine ? Math.max(1, Math.floor(engine.duration)) : manualDuration;
  const seek = (seconds: number) => { if (engine) engine.seek(seconds); else setManualTime(seconds); };
  const togglePlay = () => { if (!engine) return; if (engine.playing) engine.pause(); else engine.play(); };
  const openNewMarker = () => { engine?.pause(); setModal('new'); };

  // Jump to a marker chosen on the Reference map once the source can seek.
  useEffect(() => {
    if (!reference || pendingSeek?.referenceId !== reference.id || loading) return;
    const target = pendingSeek.time;
    pendingSeek = null;
    seek(target);
  }, [reference?.id, loading, engine]);

  // Space: play/pause · M: add marker · ←/→: move 5 s (Shift: 15 s).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (modal || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === ' ' && engine && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); togglePlay(); }
      else if (event.key.toLowerCase() === 'm' && !loading) { event.preventDefault(); openNewMarker(); }
      else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !(event.target instanceof HTMLElement && event.target.getAttribute('role') === 'slider')) {
        event.preventDefault();
        const step = (event.shiftKey ? 15 : 5) * (event.key === 'ArrowLeft' ? -1 : 1);
        seek(Math.min(total, Math.max(0, Math.round(time + step))));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!project || !reference) return <Missing title="Reference not found" back={project ? `/projects/${project.id}` : '/'} />;
  const updateReference = (change: (reference: Reference) => Reference) => setProjects((items) => items.map((item) => item.id === project.id ? { ...item, references: item.references.map((ref) => ref.id === reference.id ? change(ref) : ref), updatedAt: now() } : item));
  const saveMarker = (data: Omit<Marker, 'id' | 'createdAt'>) => {
    const current = typeof modal === 'object' ? modal : undefined;
    const marker: Marker = { ...data, id: current?.id || id(), createdAt: current?.createdAt || now() };
    updateReference((ref) => ({ ...ref, markers: current ? ref.markers.map((item) => item.id === current.id ? marker : item) : [...ref.markers, marker] }));
    setModal(null); notify(current ? 'Marker updated' : `Marker added at ${formatTime(marker.timestamp)}`);
  };
  const deleteMarker = (marker: Marker) => confirm({
    title: 'Delete marker?', message: `The ${marker.category} marker at ${formatTime(marker.timestamp)} will be removed.`, confirmLabel: 'Delete marker',
    onConfirm: () => { updateReference((ref) => ({ ...ref, markers: ref.markers.filter((item) => item.id !== marker.id) })); notify('Marker deleted'); },
  });
  const reattach = async (file: File) => {
    const problem = validateAudioFile(file);
    if (problem) { notify(problem, 'error'); return; }
    try { await putAudio(reference.id, file); } catch { notify('Could not save the audio file — browser storage is full or blocked', 'error'); return; }
    updateReference((ref) => ({ ...ref, audio: { name: file.name, size: file.size, type: file.type } }));
    setAudioVersion((version) => version + 1);
    notify('Audio file attached');
  };
  const markers = reference.markers.slice().sort((a, b) => a.timestamp - b.timestamp);
  const status = kind === 'audio'
    ? { loading: 'Loading audio…', missing: 'This audio file isn’t stored in this browser. Attach it again to play it here.', error: 'This audio file couldn’t be played. Try attaching it again or use another format.' }[audio.status as 'loading' | 'missing' | 'error']
    : kind === 'youtube'
      ? { loading: 'Loading YouTube player…', error: 'This video can’t be played outside YouTube. Listen there and set marker times by dragging the timeline.' }[video.status as 'loading' | 'error']
      : kind === 'link' ? 'This link can’t be played here. Listen in another tab and drag the timeline to the moment you want.' : 'This reference has no audio. Edit it to add a YouTube link or an audio file.';

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Projects', href: '/' }, { label: project.title, href: `/projects/${project.id}` }, { label: reference.title }]} />
      <div className={`player-top ${kind === 'youtube' ? 'has-video' : ''}`}>
        <div className="player-media">
          {kind === 'youtube' ? <div className="video-frame" ref={video.containerRef} data-testid="player-youtube" /> : <Cover reference={reference} size="large" />}
        </div>
        <div className="player-info">
          <SourceBadge reference={reference} />
          <h1>{reference.title}</h1>
          <p className="player-artist">{reference.artist}</p>
          {reference.audio && <p className="player-file"><FileAudio size={13} aria-hidden="true" /> {reference.audio.name} · {formatBytes(reference.audio.size)}</p>}
          {reference.notes && <p className="player-notes">{reference.notes}</p>}
          {reference.url && <a className="text-link" href={reference.url} target="_blank" rel="noreferrer" data-testid="link-external-reference">{kind === 'youtube' ? 'Open on YouTube' : 'Open link'} <ArrowUpRight size={13} /></a>}
        </div>
      </div>

      <section className="deck" aria-label="Playback">
        {status && !engine && (
          <div className={`deck-status ${loading ? '' : 'is-warning'}`} data-testid="text-player-status">
            <span>{status}</span>
            {kind === 'audio' && (audio.status === 'missing' || audio.status === 'error') && <FilePickerButton label="Attach audio file" onFile={reattach} />}
          </div>
        )}
        <Timeline
          duration={total}
          currentTime={time}
          peaks={kind === 'audio' ? audio.peaks : null}
          pins={markers.map((marker) => ({ id: marker.id, time: marker.timestamp, color: categoryColors[marker.category], label: marker.category }))}
          disabled={loading}
          formatTime={formatTime}
          onSeek={seek}
        />
        <div className="transport">
          <button className="play-button" onClick={togglePlay} disabled={!engine} aria-label={engine?.playing ? 'Pause' : 'Play'} data-testid="button-play-reference">
            {engine?.playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span className="transport-time"><strong>{formatTime(time)}</strong> / {formatTime(total)}</span>
          {engine && <span className="transport-hint">Space to play · M to add a marker</span>}
          <button className="button button-primary" onClick={openNewMarker} disabled={loading} data-testid="button-quick-add-marker"><Plus size={15} /> Add marker at {formatTime(time)}</button>
        </div>
      </section>

      <section className="marker-section">
        <div className="section-head"><h2>Markers</h2><span className="muted">{markers.length}</span></div>
        {markers.length === 0
          ? <EmptyState icon={Plus} title="No markers yet" body={engine ? 'Play the track and press M (or Add marker) at a moment worth remembering.' : 'Drag the timeline to a moment, then add a marker.'} />
          : <div className="marker-list">{markers.map((marker) => <MarkerRow key={marker.id} marker={marker} onSeek={() => seek(marker.timestamp)} onEdit={() => setModal(marker)} onDelete={() => deleteMarker(marker)} />)}</div>}
      </section>
      {modal && <MarkerModal initial={typeof modal === 'object' ? modal : undefined} timestamp={Math.floor(time)} onClose={() => setModal(null)} onSave={saveMarker} />}
    </div>
  );
}

function FilePickerButton({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="button" onClick={() => input.current?.click()} data-testid="button-attach-audio"><Upload size={14} /> {label}</button>
      <input ref={input} type="file" accept={audioAccept} hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onFile(file); }} data-testid="input-attach-audio" />
    </>
  );
}

function MarkerRow({ marker, onSeek, onEdit, onDelete }: { marker: Marker; onSeek: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="marker-row" style={{ '--c': categoryColors[marker.category] } as CSSProperties} data-testid={`card-marker-${marker.id}`}>
      <button className="marker-time" onClick={onSeek} aria-label={`Jump to ${formatTime(marker.timestamp)}`} data-testid={`button-seek-marker-${marker.id}`}>{formatTime(marker.timestamp)}</button>
      <CategoryChip category={marker.category} />
      <div className="marker-notes">
        <p><span className="label">What I like</span>{marker.whatILike}</p>
        <p><span className="label">How I’ll use it</span>{marker.howIWantToUseIt}</p>
      </div>
      <span className="row-actions">
        <IconButton label="Edit marker" onClick={onEdit} testId={`button-edit-marker-${marker.id}`}><Pencil size={15} /></IconButton>
        <IconButton label="Delete marker" onClick={onDelete} danger testId={`button-delete-marker-${marker.id}`}><Trash2 size={15} /></IconButton>
      </span>
    </article>
  );
}

/* ---------- Creative brief ---------- */

function Brief({ projects, notify }: { projects: Project[]; notify: Notice }) {
  const { projectId } = useParams<{ projectId: string }>();
  const project = projects.find((item) => item.id === projectId);
  const [, setLocation] = useLocation();
  if (!project) return <Missing title="Project not found" back="/" />;
  const tracks = project.references.map((reference) => ({ reference, markers: reference.markers.slice().sort((a, b) => a.timestamp - b.timestamp) })).filter(({ markers }) => markers.length);
  const total = markerCount(project);
  const briefText = [
    project.title, project.artist, project.description, '',
    ...tracks.flatMap(({ reference, markers }) => [
      `${reference.title} — ${reference.artist}${reference.url ? ` (${reference.url})` : ''}`,
      ...markers.map((marker) => `  ${formatTime(marker.timestamp)} [${marker.category}] What I like: ${marker.whatILike} / How I’ll use it: ${marker.howIWantToUseIt}`),
      '',
    ]),
  ].filter((line, index) => line !== '' || index > 2).join('\n').trim();
  const writeBrief = async () => {
    try { await navigator.clipboard.writeText(briefText); return true; } catch { return false; }
  };
  const copy = async () => { if (await writeBrief()) notify('Creative brief copied'); else notify('Could not copy — clipboard access is blocked', 'error'); };
  const share = async () => {
    if ('share' in navigator) {
      try { await navigator.share({ title: `${project.title} — Creative brief`, text: briefText }); notify('Creative brief shared'); return; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; /* other failures fall back to copy */ }
    }
    if (await writeBrief()) notify('Brief copied for sharing'); else notify('Could not share or copy the brief', 'error');
  };
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Projects', href: '/' }, { label: project.title, href: `/projects/${project.id}` }, { label: 'Creative brief' }]} />
      <PageHeader
        title="Creative brief"
        meta={<>{project.title}{project.artist ? ` · ${project.artist}` : ''} · {plural(total, 'marker')} · Edited {formatDate(project.updatedAt)}</>}
        actions={total ? <>
          <button className="button" onClick={copy} data-testid="button-copy-brief"><Copy size={14} /> Copy</button>
          <button className="button button-primary" onClick={share} data-testid="button-share-brief"><Share2 size={14} /> Share</button>
        </> : undefined}
      />
      {total === 0
        ? <EmptyState icon={FileText} title="Nothing to brief yet" body="Markers you add to references appear here, grouped by track." action={<button className="button button-primary" onClick={() => setLocation(`/projects/${project.id}`)} data-testid="button-brief-add-markers">Go to references</button>} />
        : (
          <div className="brief">
            {project.description && <p className="brief-intro">{project.description}</p>}
            {tracks.map(({ reference, markers }) => (
              <section className="brief-track" key={reference.id}>
                <header><Cover reference={reference} /><span className="track-title"><strong>{reference.title}</strong><span>{reference.artist}</span></span></header>
                <table>
                  <thead><tr><th>Time</th><th>Category</th><th>What I like</th><th>How I’ll use it</th></tr></thead>
                  <tbody>
                    {markers.map((marker) => (
                      <tr key={marker.id}>
                        <td className="time">{formatTime(marker.timestamp)}</td>
                        <td><CategoryChip category={marker.category} /></td>
                        <td>{marker.whatILike}</td>
                        <td>{marker.howIWantToUseIt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
    </div>
  );
}

/* ---------- Settings ---------- */

function SettingsPage({ projects, setProjects, notify }: { projects: Project[]; setProjects: SetProjects; notify: Notice }) {
  const confirm = useConfirm();
  const demo = seedProjects()[0];
  const existingDemo = projects.find((project) => project.id === demo.id);
  const loadDemo = () => {
    const apply = () => {
      setProjects((items) => [demo, ...items.filter((item) => item.id !== demo.id)]);
      if (existingDemo) deleteAudio(existingDemo.references.filter((reference) => reference.audio).map((reference) => reference.id));
      notify(existingDemo ? 'Demo project restored' : 'Demo project added');
    };
    if (!existingDemo) { apply(); return; }
    confirm({ title: 'Restore demo project?', message: `“${demo.title}” will be reset to its original references and markers. Your other projects are not affected.`, confirmLabel: 'Restore demo', onConfirm: apply });
  };
  const clearAll = () => confirm({
    title: 'Delete all projects?', message: `All ${plural(projects.length, 'project')} and uploaded audio files will be removed from this browser. You can add the demo project again afterwards.`, confirmLabel: 'Delete everything',
    onConfirm: () => { setProjects([]); clearAudio().catch(() => undefined); notify('All projects deleted'); },
  });
  return (
    <div className="page page-narrow">
      <PageHeader title="Settings" />
      <section className="settings-section">
        <h2>Storage</h2>
        <p>Projects and markers are saved in this browser’s local storage. Uploaded audio files are stored in this browser too (IndexedDB) and are never uploaded. Files can be up to {formatBytes(maxAudioBytes)}. YouTube videos stream from YouTube.</p>
        <p className="status-line"><span className="status-dot" /> Saving to this browser</p>
      </section>
      <section className="settings-section">
        <h2>Demo project</h2>
        <p>{existingDemo ? `“${demo.title}” is in your projects. Restore it to undo changes you made to it.` : `Add “${demo.title}”: three YouTube references with markers to explore.`}</p>
        <div className="settings-actions">
          <button className="button" onClick={loadDemo} data-testid="button-load-demo">{existingDemo ? 'Restore demo project' : 'Add demo project'}</button>
          <button className="button button-danger-quiet" onClick={clearAll} disabled={projects.length === 0} data-testid="button-clear-projects"><Trash2 size={14} /> Delete all projects</button>
        </div>
      </section>
      <section className="settings-section">
        <h2>Keyboard shortcuts</h2>
        <dl className="shortcuts">
          <div><dt><kbd>Space</kbd></dt><dd>Play or pause</dd></div>
          <div><dt><kbd>M</kbd></dt><dd>Add a marker at the current time</dd></div>
          <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Move 5 seconds (hold Shift for 15)</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>Close a dialog</dd></div>
        </dl>
      </section>
      <section className="settings-section">
        <h2>About</h2>
        <p>RefMap 1.1 · Organise reference tracks and turn the moments you like into a creative brief.</p>
      </section>
    </div>
  );
}

/* ---------- Dialogs ---------- */

function FieldError({ message }: { message?: string }) {
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}

function Field({ label, htmlFor, optional, children }: { label: string; htmlFor: string; optional?: boolean; children: ReactNode }) {
  return <div className="field"><label className="field-label" htmlFor={htmlFor}>{label}{optional && <span className="optional"> (optional)</span>}</label>{children}</div>;
}

function ProjectModal({ mode, initial, onClose, onSave }: { mode: 'new' | 'edit'; initial?: Project; onClose: () => void; onSave: (data: Pick<Project, 'title' | 'artist' | 'description'>) => void }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [artist, setArtist] = useState(initial?.artist || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [error, setError] = useState('');
  useEffect(() => { setTitle(initial?.title || ''); setArtist(initial?.artist || ''); setDescription(initial?.description || ''); }, [initial?.id]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) { setError('Give the project a title.'); return; } onSave({ title: title.trim(), artist: artist.trim(), description: description.trim() }); };
  return (
    <Modal title={mode === 'new' ? 'New project' : 'Edit project'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label="Title" htmlFor="project-title"><input id="project-title" className="input" autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} aria-invalid={!!error} placeholder="e.g. Night Transit" data-testid="input-project-title" /><FieldError message={error} /></Field>
          <Field label="Artist" htmlFor="project-artist" optional><input id="project-artist" className="input" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Who is it for?" data-testid="input-project-artist" /></Field>
          <Field label="Description" htmlFor="project-description" optional><textarea id="project-description" className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you going for?" data-testid="input-project-description" /></Field>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose} data-testid="button-cancel-project">Cancel</button>
          <button type="submit" className="button button-primary" data-testid="button-save-project"><Check size={15} /> {mode === 'new' ? 'Create project' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

type ReferenceErrors = Partial<Record<'title' | 'artist' | 'url' | 'artwork' | 'file', string>>;

function ReferenceModal({ initial, onClose, onSave }: { initial?: Reference; onClose: () => void; onSave: (data: ReferenceInput, file: File | null) => Promise<void> }) {
  const [source, setSource] = useState<'link' | 'audio'>(initial?.audio ? 'audio' : 'link');
  const [title, setTitle] = useState(initial?.title || ''); const [artist, setArtist] = useState(initial?.artist || ''); const [url, setUrl] = useState(initial?.url || ''); const [artwork, setArtwork] = useState(initial?.artwork || ''); const [notes, setNotes] = useState(initial?.notes || '');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<ReferenceErrors>({});
  const [saving, setSaving] = useState(false);
  const clearError = (field: keyof ReferenceErrors) => setErrors(({ [field]: _, ...rest }) => rest);
  const chooseFile = (chosen: File) => {
    const problem = validateAudioFile(chosen);
    if (problem) { setErrors((current) => ({ ...current, file: problem })); return; }
    setFile(chosen); clearError('file');
    if (!title.trim()) { setTitle(chosen.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()); clearError('title'); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: ReferenceErrors = {};
    if (!title.trim()) next.title = 'Add the song title.';
    if (!artist.trim()) next.artist = 'Add the artist.';
    if (url.trim() && !isHttpUrl(url.trim())) next.url = 'Enter a full link starting with https://';
    if (artwork.trim() && !isHttpUrl(artwork.trim())) next.artwork = 'Enter a full image link starting with https://';
    if (source === 'audio' && !file && !initial?.audio) next.file = 'Choose an audio file.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const audio = source === 'audio' ? (file ? { name: file.name, size: file.size, type: file.type } : initial?.audio) : undefined;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), artist: artist.trim(), url: url.trim(), artwork: artwork.trim(), notes: notes.trim(), audio }, source === 'audio' ? file : null);
    } catch {
      setErrors({ file: 'Could not save the audio file — browser storage is full or blocked.' });
      setSaving(false);
    }
  };
  const urlHint = url.trim() && isHttpUrl(url.trim())
    ? (getYouTubeVideoId(url) ? (source === 'audio' ? 'YouTube link saved for reference; the audio file is what plays here.' : 'YouTube video detected — it will play inside RefMap.') : 'Not a YouTube video — it will open in a new tab.')
    : source === 'audio' ? 'Optional link to the original track.' : 'YouTube links play inside RefMap. Other links open in a new tab.';
  return (
    <Modal title={initial ? 'Edit reference' : 'Add reference'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <span className="field-label" id="reference-source-label">Source</span>
            <Segmented<typeof source> label="Source" value={source} onChange={(value) => { setSource(value); clearError('file'); }} options={[{ value: 'link', label: 'YouTube or link', testId: 'button-source-link' }, { value: 'audio', label: 'Audio file', testId: 'button-source-audio' }]} />
          </div>
          {source === 'audio' && <Field label="Audio file" htmlFor="reference-file"><AudioDropzone file={file} current={initial?.audio} invalid={!!errors.file} onFile={chooseFile} /><FieldError message={errors.file} /></Field>}
          <Field label={source === 'audio' ? 'Link' : 'YouTube or other link'} htmlFor="reference-url" optional={source === 'audio'}>
            <input id="reference-url" className="input" type="url" value={url} onChange={(event) => { setUrl(event.target.value); clearError('url'); }} aria-invalid={!!errors.url} placeholder="https://youtube.com/watch?v=…" data-testid="input-reference-url" />
            {errors.url ? <FieldError message={errors.url} /> : <p className="form-hint" data-testid="text-url-hint">{urlHint}</p>}
          </Field>
          <div className="field-row">
            <Field label="Song title" htmlFor="reference-title"><input id="reference-title" className="input" autoFocus={!!initial || source === 'link'} value={title} onChange={(event) => { setTitle(event.target.value); clearError('title'); }} aria-invalid={!!errors.title} placeholder="Song title" data-testid="input-reference-title" /><FieldError message={errors.title} /></Field>
            <Field label="Artist" htmlFor="reference-artist"><input id="reference-artist" className="input" value={artist} onChange={(event) => { setArtist(event.target.value); clearError('artist'); }} aria-invalid={!!errors.artist} placeholder="Artist" data-testid="input-reference-artist" /><FieldError message={errors.artist} /></Field>
          </div>
          <Field label="Artwork image link" htmlFor="reference-artwork" optional><input id="reference-artwork" className="input" type="url" value={artwork} onChange={(event) => { setArtwork(event.target.value); clearError('artwork'); }} aria-invalid={!!errors.artwork} placeholder="https://…" data-testid="input-reference-artwork" /><FieldError message={errors.artwork} /></Field>
          <Field label="Notes" htmlFor="reference-notes" optional><textarea id="reference-notes" className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What should you listen for?" data-testid="input-reference-notes" /></Field>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose} data-testid="button-cancel-reference">Cancel</button>
          <button type="submit" className="button button-primary" disabled={saving} data-testid="button-save-reference"><Check size={15} /> {saving ? 'Saving…' : initial ? 'Save changes' : 'Add reference'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AudioDropzone({ file, current, invalid, onFile }: { file: File | null; current?: AudioMeta; invalid: boolean; onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const onDrop = (event: DragEvent) => {
    event.preventDefault(); setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };
  const shown = file ? { name: file.name, size: file.size, note: 'Ready to save' } : current ? { name: current.name, size: current.size, note: 'Current file — choose another to replace it' } : null;
  return (
    <label
      className={`dropzone ${dragging ? 'is-dragging' : ''} ${invalid ? 'is-invalid' : ''} ${shown ? 'has-file' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      data-testid="dropzone-audio"
    >
      <input id="reference-file" type="file" accept={audioAccept} className="visually-hidden" onChange={(event) => { const chosen = event.target.files?.[0]; event.target.value = ''; if (chosen) onFile(chosen); }} data-testid="input-reference-file" />
      {shown ? <FileAudio size={20} aria-hidden="true" /> : <Upload size={20} aria-hidden="true" />}
      <span className="dropzone-text">
        {shown ? <><strong>{shown.name}</strong><span>{formatBytes(shown.size)} · {shown.note}</span></> : <><strong>Drop an audio file or click to browse</strong><span>MP3, WAV, M4A, OGG or FLAC · up to {formatBytes(maxAudioBytes)} · stays in this browser</span></>}
      </span>
    </label>
  );
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
  return (
    <Modal title={initial ? 'Edit marker' : 'Add marker'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field-row field-row-narrow">
            <Field label="Time" htmlFor="marker-time"><input id="marker-time" className="input input-time" value={time} onChange={(event) => { setTime(event.target.value); clearError('time'); }} aria-invalid={!!errors.time} placeholder="1:32" data-testid="input-marker-timestamp" /><FieldError message={errors.time} /></Field>
            <Field label="Category" htmlFor="marker-category">
              <div className="category-picker" role="radiogroup" aria-label="Category" id="marker-category">
                {categories.map((item) => (
                  <button key={item} type="button" role="radio" aria-checked={category === item} className={`filter ${category === item ? 'active' : ''}`} style={{ '--c': categoryColors[item] } as CSSProperties} onClick={() => setCategory(item)} data-testid={`button-marker-category-${item.toLowerCase()}`}><i aria-hidden="true" />{item}</button>
                ))}
              </div>
            </Field>
          </div>
          <Field label="What I like" htmlFor="marker-like"><textarea id="marker-like" className="textarea" autoFocus={!initial} value={whatILike} onChange={(event) => { setWhatILike(event.target.value); clearError('like'); }} aria-invalid={!!errors.like} placeholder="The exact thing you hear" data-testid="input-marker-like" /><FieldError message={errors.like} /></Field>
          <Field label="How I’ll use it" htmlFor="marker-use"><textarea id="marker-use" className="textarea" value={howIWantToUseIt} onChange={(event) => { setHowIWantToUseIt(event.target.value); clearError('use'); }} aria-invalid={!!errors.use} placeholder="What you’ll do with it in your track" data-testid="input-marker-use" /><FieldError message={errors.use} /></Field>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose} data-testid="button-cancel-marker">Cancel</button>
          <button type="submit" className="button button-primary" data-testid="button-save-marker"><Check size={15} /> {initial ? 'Save marker' : 'Add marker'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children, size }: { title: string; onClose: () => void; children: ReactNode; size?: 'small' }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal ${size === 'small' ? 'modal-small' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header"><h2>{title}</h2><IconButton label="Close dialog" onClick={onClose} testId="button-close-modal"><X size={17} /></IconButton></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Missing({ title, back }: { title: string; back: string }) {
  return <div className="page"><EmptyState icon={Disc3} title={title} body="It may have been moved or deleted." action={<Link href={back} className="button" data-testid="link-missing-back">Go back</Link>} /></div>;
}

function NotFound() {
  return <Missing title="Page not found" back="/" />;
}

export default App;
