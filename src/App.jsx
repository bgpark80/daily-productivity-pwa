import { useEffect, useMemo, useRef, useState } from 'react';
import useLocalStorage from './hooks/useLocalStorage';

const STORAGE_KEY = 'notification-history-library';
const STORAGE_RESET_KEY = 'notification-history-library-reset';
const STORAGE_RESET_VERSION = '2026-04-12-empty-state';
const ALL_TYPES_LABEL = '전체 유형';
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_TIME_ZONE = 'Asia/Seoul';
const NATURAL_READER_URL = 'https://www.naturalreaders.com/online/';

const createEntryId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatDateKey = (value = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value);

const formatTimeKey = (value = new Date()) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(value);

const getDateFromKey = (dateKey) => new Date(`${dateKey}T00:00:00`);
const getCurrentSeoulDate = () => getDateFromKey(formatDateKey());
const getCurrentSeoulDateKey = () => formatDateKey();
const getCurrentSeoulTimeKey = () => formatTimeKey();
const getMonthStart = (value) => new Date(value.getFullYear(), value.getMonth(), 1);
const addMonths = (value, amount) => new Date(value.getFullYear(), value.getMonth() + amount, 1);

const inferType = (text) => {
  const normalized = text.toLowerCase();

  if (normalized.includes('태국어')) {
    return '태국어';
  }

  if (normalized.includes('회화') || normalized.includes('문장')) {
    return '회화';
  }

  if (normalized.includes('뉴스') || normalized.includes('briefing') || normalized.includes('reuters')) {
    return '뉴스';
  }

  return '기타';
};

const extractTags = (text) => {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const matches = [...firstLine.matchAll(/\[([^\[\]]+)\]/g)].map((match) => match[1].trim()).filter(Boolean);
  return [...new Set(matches)];
};

const parseRoute = (pathname = window.location.pathname) => {
  const historyMatch = pathname.match(/^\/history\/(\d{4}-\d{2}-\d{2})\/?$/);

  if (historyMatch) {
    return { name: 'history', date: historyMatch[1] };
  }

  return { name: 'library' };
};

const pushRoute = (path, setRoute) => {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }

  setRoute(parseRoute(path));
  window.scrollTo(0, 0);
};

const normalizeEntries = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  const normalizedEntries = entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id : createEntryId(),
      date: typeof entry.date === 'string' && entry.date ? entry.date : formatDateKey(),
      title: typeof entry.title === 'string' ? entry.title.trim() : '',
      type: typeof entry.type === 'string' && entry.type ? entry.type : inferType(entry.title || ''),
      time: typeof entry.time === 'string' && entry.time ? entry.time : formatTimeKey(),
      tags: Array.isArray(entry.tags)
        ? [...new Set(entry.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean))]
        : extractTags(`${entry.title || ''} ${entry.content || ''}`),
      preview: typeof entry.preview === 'string' ? entry.preview.trim() : '',
      content: typeof entry.content === 'string' ? entry.content.trim() : ''
    }))
    .filter((entry) => entry.title);

  return normalizedEntries;
};

const parseEntriesFromDraft = (draft) => {
  const trimmedDraft = draft.trim();

  if (!trimmedDraft) {
    return [];
  }

  const lines = trimmedDraft
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0] || '새 알림';
  const summaryLine = lines.slice(1).join(' ');
  const preview = (summaryLine || trimmedDraft).slice(0, 120);
  const dateMatch = trimmedDraft.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const timeMatch = trimmedDraft.match(/\b\d{1,2}:\d{2}\b/);

  return [
    {
      id: createEntryId(),
      date: dateMatch?.[0] || getCurrentSeoulDateKey(),
      title,
      type: inferType(trimmedDraft),
      time: timeMatch?.[0] || getCurrentSeoulTimeKey(),
      tags: extractTags(trimmedDraft),
      preview,
      content: trimmedDraft
    }
  ];
};

const buildEntryPatch = ({ title, content, currentEntry }) => {
  const normalizedTitle = title.trim() || currentEntry.title || '새 알림';
  const normalizedContent = content.replace(/\r\n/g, '\n').trim();
  const previewSource = normalizedContent || normalizedTitle;
  const preview = previewSource.slice(0, 120);
  const combinedText = `${normalizedTitle}\n${normalizedContent}`;

  return {
    title: normalizedTitle,
    content: normalizedContent,
    preview,
    type: inferType(combinedText),
    tags: extractTags(normalizedTitle)
  };
};

const speakText = (text) => {
  if (!('speechSynthesis' in window) || !text) {
    return false;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  return true;
};

const buildCalendarCells = (baseDate, entriesByDate) => {
  const year = baseDate.getFullYear();
  const monthIndex = baseDate.getMonth();
  const firstDayIndex = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - firstDayIndex + 1;

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return { key: `empty-${index}`, isEmpty: true };
    }

    const dateKey = formatDateKey(new Date(year, monthIndex, dayNumber));
    const dayEntries = entriesByDate.get(dateKey) || [];

    return {
      key: dateKey,
      isEmpty: false,
      dateKey,
      dayNumber,
      hasEntries: dayEntries.length > 0,
      tags: [...new Set(dayEntries.flatMap((entry) => entry.tags || []))].slice(0, 3)
    };
  });
};

function LibraryPage({
  entries,
  groupedEntries,
  availableTypes,
  searchTerm,
  setSearchTerm,
  typeFilter,
  setTypeFilter,
  draft,
  setDraft,
  onOrganizeDraft,
  onClearData,
  onOpenDate,
  onOpenEntry,
  textareaRef
}) {
  const entriesByDate = useMemo(() => {
    const groupedMap = new Map();

    entries.forEach((entry) => {
      const bucket = groupedMap.get(entry.date) || [];
      bucket.push(entry);
      groupedMap.set(entry.date, bucket);
    });

    return groupedMap;
  }, [entries]);

  const [calendarBaseDate, setCalendarBaseDate] = useState(() => getMonthStart(getCurrentSeoulDate()));
  const calendarMonthLabel = `${calendarBaseDate.getFullYear()}년 ${calendarBaseDate.getMonth() + 1}월`;
  const calendarCells = buildCalendarCells(calendarBaseDate, entriesByDate);

  return (
    <main className="library-page">
      <div className="library-layout">
        <header className="surface hero-panel">
          <div className="hero-top">
            <div className="hero-copy">
              <h1>알림 히스토리 라이브러리</h1>
              <p>
                알림으로 받은 내용을 붙여넣으면 날짜별로 자동 정리하고, 나중에 다시 읽고 들을 수 있게
                보관하는 화면
              </p>
            </div>

            <div className="hero-actions">
              <button type="button" className="button button-solid" onClick={() => textareaRef.current?.focus()}>
                새 내용 붙여넣기
              </button>
            </div>
          </div>

          <section className="calendar-panel">
            <div className="calendar-header">
              <div>
                <h2>달력으로 보기</h2>
                <p>날짜를 누르면 그날 저장된 글 목록을 새 페이지에서 확인할 수 있습니다. 달력에는 첫 줄의 대괄호 태그만 표시됩니다.</p>
              </div>
            </div>

            <div className="calendar-month-row">
              <div className="calendar-month-controls">
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => setCalendarBaseDate((currentDate) => addMonths(currentDate, -1))}
                >
                  이전 달
                </button>
                <strong>{calendarMonthLabel}</strong>
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => setCalendarBaseDate((currentDate) => addMonths(currentDate, 1))}
                >
                  다음 달
                </button>
              </div>
              <span>저장된 날짜를 눌러 상세 페이지로 이동</span>
            </div>

            <div className="calendar-grid">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="calendar-day-name">
                  {day}
                </div>
              ))}

              {calendarCells.map((cell) =>
                cell.isEmpty ? (
                  <div key={cell.key} className="calendar-cell empty" />
                ) : (
                  <button
                    key={cell.key}
                    type="button"
                    className={`calendar-cell${cell.hasEntries ? ' linked' : ''}`}
                    onClick={() => onOpenDate(cell.dateKey)}
                    disabled={!cell.hasEntries}
                  >
                    <div className="calendar-cell-inner">
                      <div className="calendar-cell-top">
                        <div className="calendar-date-number">{cell.dayNumber}</div>
                        {cell.hasEntries ? <span className="calendar-detail-link">상세</span> : null}
                      </div>

                      <div className="calendar-tags">
                        {cell.tags.map((tag) => (
                          <span key={`${cell.dateKey}-tag-${tag}`} className="calendar-tag outlined">
                            [{tag}]
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                )
              )}
            </div>
          </section>
        </header>

        <section className="top-grid">
          <section className="surface composer-panel">
            <div className="section-copy">
              <h2>입력 영역</h2>
              <p>현재 알림 내용을 그대로 붙여넣는 곳</p>
            </div>

            <label className="composer-box">
              <span className="sr-only">알림 내용 입력</span>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  '여기에 알림 내용을 그대로 붙여넣기\n입력창에 넣은 전체 내용은 한 번에 같은 날짜의 한 글로 저장됩니다.\n예: 오늘의 영어 뉴스 브리핑 [CNN] [BBC]'
                }
              />
            </label>

            <p className="composer-note">
              입력된 내용 안의 <strong>[대괄호 키워드]</strong>는 저장할 때 자동 추출되어 달력 날짜 칸과
              날짜별 상세 페이지에 함께 표시됩니다. 첫 줄의 대괄호만 사용하고, 여러 줄을 넣어도 하나의
              글로 저장됩니다.
            </p>

            <div className="stack-actions">
              <button type="button" className="button button-solid button-block" onClick={onOrganizeDraft}>
                날짜별로 정리하기
              </button>
              <button type="button" className="button button-outline button-block" onClick={onClearData}>
                저장 데이터 비우기
              </button>
            </div>
          </section>

          <section className="surface archive-panel">
            <div className="archive-toolbar">
              <div className="section-copy">
                <h2>보관된 알림</h2>
                <p>날짜별, 유형별로 확인하고 날짜 상세 페이지로 이동할 수 있습니다.</p>
              </div>

              <div className="filter-row">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="field"
                  placeholder="검색"
                />
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="field"
                >
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="archive-groups">
              {groupedEntries.length === 0 ? (
                <div className="empty-panel">
                  저장된 항목이 없습니다. 입력 영역에 실제 알림 내용을 붙여넣고 저장해 보세요.
                </div>
              ) : (
                groupedEntries.map((group) => (
                  <section key={group.date} className="date-group">
                    <div className="date-group-header">
                      <h3>{group.date}</h3>
                      <button type="button" className="text-link" onClick={() => onOpenDate(group.date)}>
                        이 날짜 열기
                      </button>
                    </div>

                    <div className="entry-list">
                      {group.items.map((entry) => (
                        <article key={entry.id} className="entry-card">
                          <div className="entry-main">
                            <div className="entry-meta">
                              <span className="pill">{entry.type}</span>
                              <span className="entry-time">{entry.time}</span>
                              {(entry.tags || []).map((tag) => (
                                <span key={tag} className="pill">
                                  [{tag}]
                                </span>
                              ))}
                            </div>
                            <h4>{entry.title}</h4>
                            <p>{entry.preview}</p>
                          </div>

                          <div className="entry-actions">
                            <button
                              type="button"
                              className="button button-outline button-small"
                              onClick={() => onOpenEntry(entry)}
                            >
                              읽기
                            </button>
                            <button
                              type="button"
                              className="button button-solid button-small"
                              onClick={() => onOpenEntry(entry, true)}
                            >
                              듣기
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function HistoryPage({
  date,
  entries,
  selectedEntry,
  speechSupported,
  isSpeaking,
  onBack,
  onSelectEntry,
  onListenEntry,
  onStopSpeaking,
  onCopySelected,
  onOpenNaturalReader,
  onCopyAndOpenNaturalReader,
  onDeleteSelected,
  onSaveSelected
}) {
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    setEditTitle(selectedEntry?.title || '');
    setEditContent(selectedEntry?.content || '');
  }, [selectedEntry]);

  return (
    <main className="library-page history-page">
      <div className="library-layout">
        <header className="surface history-header">
          <button type="button" className="text-link" onClick={onBack}>
            ← 라이브러리로 돌아가기
          </button>

          <div className="history-header-copy">
            <h1>{date}</h1>
            <p>이 날짜에 저장된 글들을 모아 보는 상세 페이지입니다.</p>
          </div>

          <div className="route-label">Route: /history/{date}</div>
        </header>

        {entries.length === 0 ? (
          <section className="surface history-empty">
            <h2>저장된 글이 없습니다</h2>
            <p>이 날짜에는 아직 등록된 항목이 없습니다. 메인 화면에서 새 알림을 저장해 보세요.</p>
          </section>
        ) : (
          <section className="history-layout-grid">
            <section className="surface history-list-panel">
              <div className="section-copy">
                <h2>등록된 글</h2>
                <p>{entries.length}개 항목</p>
              </div>

              <div className="history-list">
                {entries.map((entry) => (
                  <article
                    key={entry.id}
                    className={`history-card${selectedEntry?.id === entry.id ? ' selected' : ''}`}
                  >
                    <button type="button" className="history-card-button" onClick={() => onSelectEntry(entry.id)}>
                      <div className="entry-meta">
                        <span className="pill">{entry.type}</span>
                        <span className="entry-time">{entry.time}</span>
                      </div>
                      <h3>{entry.title}</h3>
                      <p>{entry.preview}</p>
                      <div className="history-card-tags">
                        {(entry.tags || []).map((tag) => (
                          <span key={tag} className="pill">
                            [{tag}]
                          </span>
                        ))}
                      </div>
                    </button>

                    <div className="entry-actions">
                      <button
                        type="button"
                        className="button button-outline button-small"
                        onClick={() => onSelectEntry(entry.id)}
                      >
                        읽기
                      </button>
                      <button
                        type="button"
                        className="button button-solid button-small"
                        onClick={() => onListenEntry(entry)}
                      >
                        듣기
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="surface history-detail-panel">
              <div className="section-copy">
                <h2>글 내용</h2>
                <p>선택한 글의 전체 내용을 다시 읽고 들을 수 있습니다.</p>
              </div>

              {selectedEntry ? (
                <div className="detail-card">
                  <div className="detail-meta">
                    <span className="pill">{selectedEntry.type}</span>
                    <span className="pill">{selectedEntry.date}</span>
                    <span className="pill">{selectedEntry.time}</span>
                    {(selectedEntry.tags || []).map((tag) => (
                      <span key={tag} className="pill">
                        [{tag}]
                      </span>
                    ))}
                  </div>

                  <div className="detail-edit-grid">
                    <label className="detail-field">
                      <span>제목</span>
                      <input
                        type="text"
                        className="field"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                      />
                    </label>

                    <label className="detail-field">
                      <span>본문</span>
                      <textarea
                        className="detail-textarea"
                        value={editContent}
                        onChange={(event) => setEditContent(event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="detail-actions">
                    <button
                      type="button"
                      className="button button-solid"
                      onClick={() => (isSpeaking ? onStopSpeaking() : onListenEntry(selectedEntry))}
                      disabled={!speechSupported}
                    >
                      {isSpeaking ? '정지' : '전체 듣기'}
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => onSaveSelected({ title: editTitle, content: editContent })}
                    >
                      저장
                    </button>
                    <button type="button" className="button button-outline" onClick={onCopySelected}>
                      복사
                    </button>
                    <button type="button" className="button button-outline" onClick={onOpenNaturalReader}>
                      NaturalReader에서 열기
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={onCopyAndOpenNaturalReader}
                    >
                      복사 후 열기
                    </button>
                    <button
                      type="button"
                      className="button button-outline button-danger"
                      onClick={onDeleteSelected}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-panel">표시할 글이 없습니다.</div>
              )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}

function App() {
  const [storedEntries, setStoredEntries] = useLocalStorage(STORAGE_KEY, [], {
    resetKey: STORAGE_RESET_KEY,
    resetVersion: STORAGE_RESET_VERSION
  });
  const [route, setRoute] = useState(() => parseRoute());
  const [draft, setDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES_LABEL);
  const [selectedId, setSelectedId] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speakingEntryId, setSpeakingEntryId] = useState('');
  const textareaRef = useRef(null);

  const entries = useMemo(
    () =>
      normalizeEntries(storedEntries).sort((firstEntry, secondEntry) =>
        `${secondEntry.date} ${secondEntry.time}`.localeCompare(`${firstEntry.date} ${firstEntry.time}`)
      ),
    [storedEntries]
  );

  const entriesByDate = useMemo(() => {
    const groupedMap = new Map();

    entries.forEach((entry) => {
      const bucket = groupedMap.get(entry.date) || [];
      bucket.push(entry);
      groupedMap.set(entry.date, bucket);
    });

    return groupedMap;
  }, [entries]);

  const availableTypes = [ALL_TYPES_LABEL, ...new Set(entries.map((entry) => entry.type))];
  const filteredEntries = entries.filter((entry) => {
    const matchesType = typeFilter === ALL_TYPES_LABEL || entry.type === typeFilter;
    const searchable = `${entry.title} ${entry.preview} ${entry.content} ${(entry.tags || []).join(' ')}`.toLowerCase();
    const matchesSearch = searchable.includes(searchTerm.trim().toLowerCase());

    return matchesType && matchesSearch;
  });

  const groupedEntries = filteredEntries.reduce((groups, entry) => {
    const existingGroup = groups.find((group) => group.date === entry.date);

    if (existingGroup) {
      existingGroup.items.push(entry);
      return groups;
    }

    groups.push({ date: entry.date, items: [entry] });
    return groups;
  }, []);

  const historyEntries = route.name === 'history' ? entriesByDate.get(route.date) || [] : [];
  const selectedHistoryEntry =
    historyEntries.find((entry) => entry.id === selectedId) || historyEntries[0] || null;

  useEffect(() => {
    setSpeechSupported('speechSynthesis' in window);

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (route.name === 'history' && selectedHistoryEntry && selectedId !== selectedHistoryEntry.id) {
      setSelectedId(selectedHistoryEntry.id);
    }
  }, [route, selectedHistoryEntry, selectedId]);

  const navigateToLibrary = () => {
    pushRoute('/', setRoute);
  };

  const navigateToHistoryDate = (dateKey) => {
    if (!dateKey) {
      return;
    }

    pushRoute(`/history/${dateKey}`, setRoute);
  };

  const handleOpenEntry = (entry, shouldSpeak = false) => {
    setSelectedId(entry.id);
    navigateToHistoryDate(entry.date);

    if (shouldSpeak) {
      handleListenEntry(entry);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setSpeakingEntryId('');
  };

  const handleListenEntry = (entry) => {
    if (!speechSupported) {
      return;
    }

    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(entry.content || entry.preview || entry.title);
    utterance.onend = () => setSpeakingEntryId('');
    utterance.onerror = () => setSpeakingEntryId('');
    setSpeakingEntryId(entry.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleOrganizeDraft = () => {
    const parsedEntries = parseEntriesFromDraft(draft);

    if (parsedEntries.length === 0) {
      textareaRef.current?.focus();
      return;
    }

    setStoredEntries((currentEntries) => [...parsedEntries, ...normalizeEntries(currentEntries)]);
    setDraft('');
    setSelectedId(parsedEntries[0].id);
    navigateToHistoryDate(parsedEntries[0].date);
  };

  const handleClearData = () => {
    stopSpeaking();
    setStoredEntries([]);
    setSelectedId('');
    navigateToLibrary();
  };

  const handleCopySelected = async () => {
    if (!selectedHistoryEntry || !navigator.clipboard) {
      return false;
    }

    const payload = `${selectedHistoryEntry.title}\n${selectedHistoryEntry.content || selectedHistoryEntry.preview}`;

    try {
      await navigator.clipboard.writeText(payload);
      return true;
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      return false;
    }
  };

  const handleOpenNaturalReader = () => {
    window.open(NATURAL_READER_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopyAndOpenNaturalReader = async () => {
    await handleCopySelected();
    handleOpenNaturalReader();
  };

  const handleDeleteSelected = () => {
    if (!selectedHistoryEntry || route.name !== 'history') {
      return;
    }

    if (speakingEntryId === selectedHistoryEntry.id) {
      stopSpeaking();
    }

    const nextEntries = entries.filter((entry) => entry.id !== selectedHistoryEntry.id);
    const nextSameDateEntries = nextEntries.filter((entry) => entry.date === route.date);

    setStoredEntries(nextEntries);
    setSelectedId(nextSameDateEntries[0]?.id || '');

    if (nextSameDateEntries.length === 0) {
      navigateToLibrary();
    }
  };

  const handleSaveSelected = ({ title, content }) => {
    if (!selectedHistoryEntry) {
      return;
    }

    const patch = buildEntryPatch({ title, content, currentEntry: selectedHistoryEntry });

    setStoredEntries((currentEntries) =>
      normalizeEntries(currentEntries).map((entry) =>
        entry.id === selectedHistoryEntry.id ? { ...entry, ...patch } : entry
      )
    );
  };

  if (route.name === 'history') {
    return (
      <HistoryPage
        date={route.date}
        entries={historyEntries}
        selectedEntry={selectedHistoryEntry}
        speechSupported={speechSupported}
        isSpeaking={speakingEntryId === selectedHistoryEntry?.id}
        onBack={navigateToLibrary}
        onSelectEntry={setSelectedId}
        onListenEntry={(entry) => {
          setSelectedId(entry.id);
          handleListenEntry(entry);
        }}
        onStopSpeaking={stopSpeaking}
        onCopySelected={handleCopySelected}
        onOpenNaturalReader={handleOpenNaturalReader}
        onCopyAndOpenNaturalReader={handleCopyAndOpenNaturalReader}
        onDeleteSelected={handleDeleteSelected}
        onSaveSelected={handleSaveSelected}
      />
    );
  }

  return (
    <LibraryPage
      entries={entries}
      groupedEntries={groupedEntries}
      availableTypes={availableTypes}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      draft={draft}
      setDraft={setDraft}
      onOrganizeDraft={handleOrganizeDraft}
      onClearData={handleClearData}
      onOpenDate={navigateToHistoryDate}
      onOpenEntry={handleOpenEntry}
      textareaRef={textareaRef}
    />
  );
}

export default App;
