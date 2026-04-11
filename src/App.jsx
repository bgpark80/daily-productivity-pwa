import { useEffect, useRef, useState } from 'react';
import useLocalStorage from './hooks/useLocalStorage';

const STORAGE_KEY = 'notification-history-library';

const SAMPLE_ENTRIES = [
  {
    id: 'sample-news-20260412',
    date: '2026-04-12',
    title: '오전 6시 영어 뉴스 브리핑',
    type: '뉴스',
    time: '06:00',
    preview: 'CNN, BBC, Yahoo Finance, Reuters 요약과 핵심 표현 정리',
    content:
      'CNN, BBC, Yahoo Finance, Reuters 요약과 핵심 표현 정리. 이 영역에는 실제 붙여넣은 원문이 들어가며, 날짜별로 저장된 내용을 다시 읽고 들을 수 있습니다.'
  },
  {
    id: 'sample-speaking-20260412',
    date: '2026-04-12',
    title: '오후 8시 55분 영어회화 3문장',
    type: '회화',
    time: '20:55',
    preview: '오늘의 표현 3개와 실전 시나리오 1개',
    content:
      '오늘의 표현 3개와 실전 시나리오 1개. 짧게 다시 읽고 따라 말할 수 있도록 예문과 핵심 문장을 함께 보관합니다.'
  },
  {
    id: 'sample-thai-20260411',
    date: '2026-04-11',
    title: '태국어 학습 루틴',
    type: '태국어',
    time: '07:30',
    preview: '읽기, 쓰기, 말하기 중심의 IT/TPM 키워드 학습',
    content:
      '읽기, 쓰기, 말하기 중심의 IT/TPM 키워드 학습. 업무 맥락에서 자주 보는 단어와 발음 포인트를 같이 정리합니다.'
  }
];

const createEntryId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatDateKey = (value = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value);

const formatTimeKey = (value = new Date()) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(value);

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

const normalizeEntries = (entries) => {
  if (!Array.isArray(entries)) {
    return SAMPLE_ENTRIES;
  }

  const normalizedEntries = entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id : createEntryId(),
      date: typeof entry.date === 'string' && entry.date ? entry.date : formatDateKey(),
      title: typeof entry.title === 'string' ? entry.title.trim() : '',
      type: typeof entry.type === 'string' && entry.type ? entry.type : inferType(entry.title || ''),
      time: typeof entry.time === 'string' && entry.time ? entry.time : formatTimeKey(),
      preview: typeof entry.preview === 'string' ? entry.preview.trim() : '',
      content: typeof entry.content === 'string' ? entry.content.trim() : ''
    }))
    .filter((entry) => entry.title);

  return normalizedEntries.length > 0 ? normalizedEntries : SAMPLE_ENTRIES;
};

const parseEntriesFromDraft = (draft) => {
  const trimmedDraft = draft.trim();

  if (!trimmedDraft) {
    return [];
  }

  const blocks = trimmedDraft
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const now = new Date();

  return blocks.map((block) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const title = lines[0] || '새 알림';
    const content = block;
    const summaryLine = lines.slice(1).join(' ');
    const preview = (summaryLine || block).slice(0, 120);
    const dateMatch = block.match(/\b\d{4}-\d{2}-\d{2}\b/);
    const timeMatch = block.match(/\b\d{1,2}:\d{2}\b/);

    return {
      id: createEntryId(),
      date: dateMatch?.[0] || formatDateKey(now),
      title,
      type: inferType(block),
      time: timeMatch?.[0] || formatTimeKey(now),
      preview,
      content
    };
  });
};

const speakText = (text) => {
  if (!('speechSynthesis' in window) || !text) {
    return false;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  return true;
};

function App() {
  const [storedEntries, setStoredEntries] = useLocalStorage(STORAGE_KEY, SAMPLE_ENTRIES);
  const [draft, setDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('전체 유형');
  const [selectedId, setSelectedId] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const textareaRef = useRef(null);

  const entries = normalizeEntries(storedEntries).sort((firstEntry, secondEntry) => {
    const firstValue = `${firstEntry.date} ${firstEntry.time}`;
    const secondValue = `${secondEntry.date} ${secondEntry.time}`;
    return secondValue.localeCompare(firstValue);
  });

  const availableTypes = ['전체 유형', ...new Set(entries.map((entry) => entry.type))];
  const filteredEntries = entries.filter((entry) => {
    const matchesType = typeFilter === '전체 유형' || entry.type === typeFilter;
    const searchable = `${entry.title} ${entry.preview} ${entry.content}`.toLowerCase();
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

  const selectedEntry =
    filteredEntries.find((entry) => entry.id === selectedId) ||
    entries.find((entry) => entry.id === selectedId) ||
    filteredEntries[0] ||
    entries[0] ||
    null;

  useEffect(() => {
    setSpeechSupported('speechSynthesis' in window);
  }, []);

  useEffect(() => {
    if (selectedEntry && selectedId !== selectedEntry.id) {
      setSelectedId(selectedEntry.id);
    }
  }, [selectedEntry, selectedId]);

  const focusInput = () => {
    textareaRef.current?.focus();
  };

  const handleOrganizeDraft = () => {
    const parsedEntries = parseEntriesFromDraft(draft);

    if (parsedEntries.length === 0) {
      focusInput();
      return;
    }

    setStoredEntries((currentEntries) => [...parsedEntries, ...normalizeEntries(currentEntries)]);
    setDraft('');
    setSelectedId(parsedEntries[0].id);
  };

  const handleLoadSamples = () => {
    setStoredEntries(SAMPLE_ENTRIES);
    setSelectedId(SAMPLE_ENTRIES[0].id);
  };

  const handleReadEntry = (entry) => {
    setSelectedId(entry.id);
  };

  const handleListenEntry = (entry) => {
    setSelectedId(entry.id);
    speakText(entry.content || entry.preview || entry.title);
  };

  const handleDeleteSelected = () => {
    if (!selectedEntry) {
      return;
    }

    const nextEntries = entries.filter((entry) => entry.id !== selectedEntry.id);
    setStoredEntries(nextEntries);
    setSelectedId(nextEntries[0]?.id || '');
  };

  const handleCopySelected = async () => {
    if (!selectedEntry || !navigator.clipboard) {
      return;
    }

    const payload = `${selectedEntry.title}\n${selectedEntry.content || selectedEntry.preview}`;

    try {
      await navigator.clipboard.writeText(payload);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
    }
  };

  return (
    <main className="library-page">
      <div className="library-layout">
        <header className="surface hero-panel">
          <div className="hero-copy">
            <h1>알림 히스토리 라이브러리</h1>
            <p>
              알림으로 받은 내용을 붙여넣으면 날짜별로 자동 정리하고, 나중에 다시 읽고 들을 수
              있게 보관하는 화면
            </p>
          </div>

          <div className="hero-actions">
            <button type="button" className="button button-solid" onClick={focusInput}>
              새 내용 붙여넣기
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={() => selectedEntry && speakText(selectedEntry.content || selectedEntry.title)}
              disabled={!selectedEntry || !speechSupported}
            >
              음성 재생
            </button>
          </div>
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
                  '여기에 알림 내용을 그대로 붙여넣기\n예: 오늘의 영어 뉴스 브리핑 / 영어회화 3문장 / 태국어 루틴'
                }
              />
            </label>

            <div className="stack-actions">
              <button
                type="button"
                className="button button-solid button-block"
                onClick={handleOrganizeDraft}
              >
                날짜별로 정리하기
              </button>
              <button
                type="button"
                className="button button-outline button-block"
                onClick={handleLoadSamples}
              >
                샘플 데이터 넣기
              </button>
            </div>
          </section>

          <section className="surface archive-panel">
            <div className="archive-toolbar">
              <div className="section-copy">
                <h2>보관된 알림</h2>
                <p>날짜별, 유형별로 확인하고 다시 읽거나 들을 수 있음</p>
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
                  검색 조건에 맞는 항목이 없습니다. 입력 영역에 새 알림을 붙여넣어 보관해 보세요.
                </div>
              ) : (
                groupedEntries.map((group) => (
                  <section key={group.date} className="date-group">
                    <div className="date-group-header">
                      <h3>{group.date}</h3>
                      <span>{group.items.length}개 항목</span>
                    </div>

                    <div className="entry-list">
                      {group.items.map((entry) => (
                        <article
                          key={entry.id}
                          className={`entry-card${selectedEntry?.id === entry.id ? ' selected' : ''}`}
                        >
                          <div className="entry-main">
                            <div className="entry-meta">
                              <span className="pill">{entry.type}</span>
                              <span className="entry-time">{entry.time}</span>
                            </div>
                            <h4>{entry.title}</h4>
                            <p>{entry.preview}</p>
                          </div>

                          <div className="entry-actions">
                            <button
                              type="button"
                              className="button button-outline button-small"
                              onClick={() => handleReadEntry(entry)}
                            >
                              읽기
                            </button>
                            <button
                              type="button"
                              className="button button-solid button-small"
                              onClick={() => handleListenEntry(entry)}
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

        <section className="surface detail-panel">
          <div className="section-copy">
            <h2>상세 보기 패널</h2>
            <p>선택한 항목의 전체 내용, 핵심 문장, 단어, 음성 재생 버튼이 보이는 영역</p>
          </div>

          <div className="detail-card">
            {selectedEntry ? (
              <>
                <div className="detail-meta">
                  <span className="pill">{selectedEntry.type}</span>
                  <span className="pill">{selectedEntry.date}</span>
                  <span className="pill">{selectedEntry.time}</span>
                </div>

                <h3>{selectedEntry.title}</h3>
                <p>
                  {selectedEntry.content ||
                    '이 영역에는 실제 붙여넣은 원문이 들어간다. 사용자는 날짜별로 저장된 내용을 다시 읽고, 음성 버튼을 눌러 다시 들을 수 있다.'}
                </p>

                <div className="detail-actions">
                  <button
                    type="button"
                    className="button button-solid"
                    onClick={() => speakText(selectedEntry.content || selectedEntry.title)}
                    disabled={!speechSupported}
                  >
                    전체 듣기
                  </button>
                  <button type="button" className="button button-outline" onClick={handleCopySelected}>
                    복사
                  </button>
                  <button
                    type="button"
                    className="button button-outline button-danger"
                    onClick={handleDeleteSelected}
                  >
                    삭제
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-panel">
                아직 선택된 항목이 없습니다. 샘플 데이터를 넣거나 새 알림을 붙여넣어 시작하세요.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
