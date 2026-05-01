import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Download, Upload, Copy, RotateCcw, Play, Check, X, ChevronLeft, ChevronRight, List, Trash2, History as HistoryIcon, Home as HomeIcon } from 'lucide-react';

// --- Types ---
interface Card {
  front: string;
  back: string;
  note?: string;
}

interface Deck {
  title: string;
  cards: Card[];
  rootTitle?: string;
  rootCards?: Card[];
  importedAt?: string;
}

interface TestRecord {
  id: string; // Unique ID
  sourceDeckTitle: string; // the original imported deck title
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  originalCards: Card[]; // cards used in this specific test
  results: { [cardIndex: number]: boolean }; // true = know, false = don't know
  rootTitle?: string;
  rootCards?: Card[];
}

// --- DB/LocalStorage ---
const DB_KEY_DECKS = 'flashcards_decks';
const DB_KEY_HISTORY = 'flashcards_history';

const getDecks = (): Deck[] => JSON.parse(localStorage.getItem(DB_KEY_DECKS) || '[]');
const saveDecks = (decks: Deck[]) => localStorage.setItem(DB_KEY_DECKS, JSON.stringify(decks));

const getHistory = (): TestRecord[] => JSON.parse(localStorage.getItem(DB_KEY_HISTORY) || '[]');
const saveHistory = (history: TestRecord[]) => localStorage.setItem(DB_KEY_HISTORY, JSON.stringify(history));

const generateId = () => Math.random().toString(36).substring(2, 9);
const getTimestamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

// --- App Component ---
export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'quiz' | 'result' | 'history'>('home');
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [activeTestRecord, setActiveTestRecord] = useState<TestRecord | null>(null);
  const [quizState, setQuizState] = useState<{ currentIndex: number; answers: { [index: number]: boolean } }>({ currentIndex: 0, answers: {} });
  const [historyKey, setHistoryKey] = useState(0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [promptConfig, setPromptConfig] = useState<{isOpen: boolean, title: string, onSubmit: (val: string) => void, submitText?: string, inputType?: 'text' | 'textarea', isDanger?: boolean} | null>(null);

  const showAlert = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showPrompt = (title: string, onSubmit: (val: string) => void, options?: { submitText?: string, inputType?: 'text' | 'textarea', isDanger?: boolean }) => {
    setPromptConfig({ isOpen: true, title, onSubmit, ...options });
  };

  // Home View
  const processImportData = (jsonString: string) => {
    try {
      const json = JSON.parse(jsonString);
      if (json.title && Array.isArray(json.cards)) {
        json.importedAt = getTimestamp();
        const decks = getDecks();
        decks.push(json);
        saveDecks(decks);
        showAlert('匯入成功！');
        setCurrentView('history');
      } else {
        showAlert('JSON 格式錯誤，必須包含 title 與 cards 陣列。');
      }
    } catch (err) {
      showAlert('解析 JSON 錯誤！請確認格式是否正確。');
    }
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      processImportData(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImportFile(file);
    e.target.value = '';
  };

  const copyExample = () => {
    const example = {
      title: "Unit 20 必備單字與衍生詞組集",
      cards: [
        { "front": "admire", "back": "欣賞；讚賞；佩服 (v.)" },
        { "front": "budget airline", "back": "廉價航空" },
        { "front": "automobile", "back": "汽車 (n.)", "note": "The automobile industry has seen significant growth in the past decade.（汽車工業在過去十年中有了顯著的成長）" }
      ]
    };
    navigator.clipboard.writeText(JSON.stringify(example, null, 2));
    showAlert('範例已複製到剪貼簿！');
  };

  const startQuiz = (deck: Deck) => {
    setActiveDeck(deck);
    setQuizState({ currentIndex: 0, answers: {} });
    setCurrentView('quiz');
  };

  const finishQuiz = (finalAnswers: { [index: number]: boolean }) => {
    if (!activeDeck) return;
    const record: TestRecord = {
      id: generateId(),
      sourceDeckTitle: activeDeck.title,
      timestamp: getTimestamp(),
      originalCards: activeDeck.cards,
      results: finalAnswers,
      rootTitle: activeDeck.rootTitle || activeDeck.title,
      rootCards: activeDeck.rootCards || activeDeck.cards,
    };
    const history = getHistory();
    history.push(record);
    saveHistory(history);
    setActiveTestRecord(record);
    setCurrentView('result');
  };

  const handleGlobalBackup = () => {
    const data = { decks: getDecks(), history: getHistory() };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    showAlert('全部資料已複製到剪貼簿！可以儲存成檔案備份。');
  };

  const handleGlobalRestore = () => {
    showPrompt('請貼上備份的 JSON 資料：', (input) => {
      try {
        const data = JSON.parse(input);
        if (data.decks && data.history) {
          saveDecks(data.decks);
          saveHistory(data.history);
          showAlert('還原成功！');
          setHistoryKey((prev: number) => prev + 1);
          setCurrentView('history'); // refresh
        } else showAlert('格式不正確！');
      } catch {
        showAlert('解析錯誤！');
      }
    });
  };

  const handleClearHistory = () => {
    showPrompt('請輸入「確認刪除歷史紀錄」以清空歷史紀錄', (input) => {
      if (input.trim() === '確認刪除歷史紀錄') {
        saveHistory([]);
        setHistoryKey((prev: number) => prev + 1);
        showAlert('歷史紀錄已清空');
      } else {
        showAlert('輸入錯誤，未清空紀錄');
      }
    }, { submitText: '確認刪除歷史紀錄', inputType: 'text', isDanger: true });
  };

  const handleClearDecks = () => {
    showPrompt('請輸入「確認刪除匯入的排組」以清空所有牌組', (input) => {
      if (input.trim() === '確認刪除匯入的排組') {
        saveDecks([]);
        setHistoryKey((prev: number) => prev + 1);
        showAlert('匯入的排組已清空');
      } else {
        showAlert('輸入錯誤，未清空排組');
      }
    }, { submitText: '確認刪除匯入的排組', inputType: 'text', isDanger: true });
  };

  return (
    <div className="max-w-md mx-auto h-full flex flex-col bg-white shadow-xl relative overflow-hidden">
      {/* Navbar */}
      <div className="flex items-center justify-between p-4 border-b bg-white z-10 shadow-sm sticky top-0">
        <h1 className="font-bold text-xl text-blue-600 truncate">閃卡測驗平台</h1>
        <div className="flex gap-2 text-gray-600">
          <button onClick={() => setCurrentView('home')} className="p-2 hover:bg-gray-100 rounded-full"><HomeIcon size={20}/></button>
          <button onClick={() => setCurrentView('history')} className="p-2 hover:bg-gray-100 rounded-full"><HistoryIcon size={20}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative bg-gray-50">
        {currentView === 'home' && <HomeView onImport={handleImport} onCopyExample={copyExample} onProcessData={processImportData} onHandleFile={handleImportFile} onShowAlert={showAlert} />}
        {currentView === 'quiz' && activeDeck && <QuizView deck={activeDeck} state={quizState} setState={setQuizState} onFinish={finishQuiz} />}
        {currentView === 'result' && activeTestRecord && <ResultView record={activeTestRecord} onRetest={(cards, title, isRoot) => {
          if (isRoot) {
            startQuiz({ title, cards });
          } else {
            startQuiz({ title, cards, rootTitle: activeTestRecord.rootTitle || activeTestRecord.sourceDeckTitle, rootCards: activeTestRecord.rootCards || activeTestRecord.originalCards });
          }
        }} onShowAlert={showAlert} />}
        {currentView === 'history' && <HistoryView key={historyKey} onStartQuiz={startQuiz} onGlobalBackup={handleGlobalBackup} onGlobalRestore={handleGlobalRestore} onClearHistory={handleClearHistory} onClearDecks={handleClearDecks} onShowAlert={showAlert} />}
      </div>

      {/* Custom Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }} 
            animate={{ opacity: 1, y: 0, x: '-50%' }} 
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-20 left-1/2 z-50 bg-white border border-gray-100 shadow-xl rounded-xl py-3 px-5 flex items-center justify-center pointer-events-none min-w-[250px]"
          >
            <span className="text-gray-800 font-medium text-sm">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Prompt Modal */}
      {promptConfig?.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-5">
              <h2 className="text-lg font-bold text-gray-800 mb-4">{promptConfig.title}</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const inputVal = formData.get('promptInput') as string;
                setPromptConfig(null);
                if (inputVal && inputVal.trim() !== '') {
                  promptConfig.onSubmit(inputVal);
                }
              }}>
                {promptConfig.inputType === 'text' ? (
                  <input 
                    type="text"
                    name="promptInput"
                    className={`w-full p-3 border rounded-xl focus:ring-2 focus:outline-none mb-4 text-sm ${promptConfig.isDanger ? 'focus:ring-red-500 border-red-300' : 'focus:ring-blue-500'}`}
                    placeholder="請在此輸入..."
                    autoFocus
                    autoComplete="off"
                  />
                ) : (
                  <textarea 
                    name="promptInput"
                    className={`w-full h-32 p-3 border rounded-xl focus:ring-2 focus:outline-none mb-4 resize-none text-sm ${promptConfig.isDanger ? 'focus:ring-red-500 border-red-300' : 'focus:ring-blue-500'}`}
                    placeholder="請在此輸入..."
                    autoFocus
                  />
                )}
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setPromptConfig(null)} className="px-4 py-2 font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition">取消</button>
                  <button type="submit" className={`px-4 py-2 font-bold text-white rounded-lg shadow transition ${promptConfig.isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{promptConfig.submitText || '確認'}</button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- Views ---

function HomeView({ 
  onImport, 
  onCopyExample, 
  onProcessData, 
  onHandleFile,
  onShowAlert
}: { 
  onImport: any; 
  onCopyExample: any; 
  onProcessData: (data: string) => void;
  onHandleFile: (file: File) => void;
  onShowAlert: (msg: string) => void;
}) {
  const [textInput, setTextInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.json') || file.name.endsWith('.txt')) {
        onHandleFile(file);
      } else {
        onShowAlert('請上傳 .json 或 .txt 格式的檔案');
      }
    }
  };

  return (
    <div 
      className={`flex flex-col items-center justify-center h-full gap-4 px-4 text-center transition-colors duration-200 ${isDragging ? 'bg-blue-50 border-2 border-dashed border-blue-400 rounded-xl' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-2">
        <Upload size={36} />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-1">匯入您的單字卡</h2>
        <p className="text-gray-500 text-sm">支援 .json / .txt 檔案拖放、點擊上傳，或直接貼上 JSON 內容</p>
      </div>
      
      <div className="w-full max-w-sm flex flex-col gap-3">
        <textarea
          className="w-full h-32 p-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="在此貼上或輸入 JSON 文字..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
        />
        <button 
          onClick={() => {
            if (!textInput.trim()) return onShowAlert("請先輸入內容");
            onProcessData(textInput);
          }}
          className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-medium hover:bg-blue-200 transition shadow-sm w-full"
        >
          提交文字內容
        </button>
      </div>

      <div className="mt-2 text-gray-400 text-sm">或</div>

      <label className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium cursor-pointer hover:bg-blue-700 transition shadow-lg w-full max-w-sm">
        點擊選擇檔案上傳
        <input type="file" accept=".json,.txt" className="hidden" onChange={onImport} />
      </label>

      <button onClick={onCopyExample} className="text-blue-600 flex items-center justify-center gap-2 mt-2 hover:underline text-sm">
        <Copy size={16} /> 複製參考格式
      </button>
    </div>
  );
}

function QuizView({ deck, state, setState, onFinish }: { deck: Deck, state: any, setState: any, onFinish: (ans: any) => void }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const card = deck.cards[state.currentIndex];
  const isFinished = state.currentIndex >= deck.cards.length;

  useEffect(() => { setIsFlipped(false); }, [state.currentIndex]);

  const handleAnswer = (know: boolean) => {
    const newAnswers = { ...state.answers, [state.currentIndex]: know };
    setState({ currentIndex: state.currentIndex + 1, answers: newAnswers });
    if (state.currentIndex + 1 >= deck.cards.length) finish(newAnswers);
  };

  const finish = (finalAnswers: any) => {
    onFinish(finalAnswers);
  };

  const prevCard = () => {
    if (state.currentIndex > 0) {
      setState({ ...state, currentIndex: state.currentIndex - 1 });
    }
  };
  const nextCard = () => {
    if (state.currentIndex < deck.cards.length - 1) {
      setState({ ...state, currentIndex: state.currentIndex + 1 });
    }
  };

  if (isFinished) return null;

  return (
    <div className="flex flex-col h-full inset-0 absolute bg-gray-50 p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm font-medium text-gray-500">
          進度: {state.currentIndex + 1} / {deck.cards.length}
        </div>
        {state.answers[state.currentIndex] !== undefined && (
          <div className={`text-xs px-2 py-1 rounded-full text-white font-bold ${state.answers[state.currentIndex] ? 'bg-green-500' : 'bg-red-500'}`}>
            先前作答: {state.answers[state.currentIndex] ? '會' : '不會'}
          </div>
        )}
      </div>

      <div className="flex-1 relative flex items-center justify-center w-full">
        {/* Swipeable Card Area */}
        <motion.div
          className="w-full h-96 relative perspective-1000"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, { offset }) => {
            const swipeLeft = offset.x < -50;
            const swipeRight = offset.x > 50;
            if (swipeRight) handleAnswer(true);
            else if (swipeLeft) handleAnswer(false);
          }}
        >
          <motion.div
            className="w-full h-full cursor-pointer preserve-3d transition-transform duration-500 ease-in-out relative"
            style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Front */}
            <div className="absolute w-full h-full bg-white rounded-2xl shadow-lg border-2 border-slate-100 p-6 flex items-center justify-center backface-hidden">
              <h2 className="text-3xl font-bold text-center text-slate-800 break-words">{card.front}</h2>
              <div className="absolute top-4 right-4 animate-pulse opacity-50"><RotateCcw size={20} /></div>
            </div>
            {/* Back */}
            <div className="absolute w-full h-full bg-indigo-50 rounded-2xl shadow-lg border-2 border-indigo-100 p-6 flex flex-col items-center justify-center backface-hidden" style={{ transform: 'rotateY(180deg)' }}>
              <h2 className="text-3xl font-bold text-center text-indigo-900 break-words">{card.back}</h2>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div className="mt-8 flex gap-4 w-full">
        <button onClick={() => handleAnswer(false)} className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95">
          <X size={24} /> 不會 (左滑)
        </button>
        <button onClick={() => handleAnswer(true)} className="flex-1 bg-green-100 hover:bg-green-200 text-green-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95">
          <Check size={24} /> 會 (右滑)
        </button>
      </div>

      <div className="flex justify-between mt-6">
        <button disabled={state.currentIndex === 0} onClick={prevCard} className="flex items-center text-gray-500 disabled:opacity-30 disabled:pointer-events-none p-2 active:bg-gray-200 rounded">
          <ChevronLeft size={20}/> 上一題
        </button>
        <button disabled={state.currentIndex >= deck.cards.length - 1} onClick={nextCard} className="flex items-center text-gray-500 disabled:opacity-30 disabled:pointer-events-none p-2 active:bg-gray-200 rounded">
          下一題 <ChevronRight size={20}/>
        </button>
      </div>
    </div>
  );
}

function ResultView({ record, onRetest, onShowAlert }: { record: TestRecord, onRetest: (cards: Card[], title: string, isRoot?: boolean) => void, onShowAlert: (msg: string) => void }) {
  const total = record.originalCards.length;
  const correct = Object.values(record.results).filter(v => v).length;
  const incorrect = total - correct;

  const data = [
    { name: '會', value: correct, color: '#22c55e' },
    { name: '不會', value: incorrect, color: '#ef4444' }
  ];

  const exportJSON = (text: string) => {
    navigator.clipboard.writeText(text);
    onShowAlert('已匯出並複製到剪貼簿！');
  };

  const getMistakesCards = () => record.originalCards.filter((_, i) => !record.results[i]);

  return (
    <div className="flex flex-col pb-10">
      <h2 className="text-2xl font-bold text-center mb-6 mt-2">測驗結果</h2>
      
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
              {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
            </Pie>
            <RechartsTooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-8 text-sm font-medium">
        <div className="text-green-600">會: {correct} 題</div>
        <div className="text-red-600">不會: {incorrect} 題</div>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <button className="bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-md w-full" onClick={() => onRetest(record.rootCards || record.originalCards, record.rootTitle || record.sourceDeckTitle, true)}>
          再考一次 (完整)
        </button>
        {incorrect > 0 && (
          <button className="bg-rose-500 text-white font-bold py-3 px-4 rounded-xl shadow-md w-full" onClick={() => onRetest(getMistakesCards(), record.sourceDeckTitle + ' (錯題)')}>
            考錯題 ({incorrect})
          </button>
        )}
        {record.rootCards && record.rootCards.length !== record.originalCards.length && (
          <button className="bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-md w-full" onClick={() => onRetest(record.originalCards, record.sourceDeckTitle)}>
            再考一次 (本次)
          </button>
        )}
      </div>

      <details className="mt-8 bg-white border rounded-xl overflow-hidden shadow-sm">
        <summary className="p-4 font-bold bg-gray-50 cursor-pointer flex items-center justify-between">
          <span>詳細測驗清單</span>
          <List size={20} className="text-gray-400" />
        </summary>
        <div className="divide-y max-h-64 overflow-y-auto">
          {record.originalCards.map((c, i) => (
            <div key={i} className="p-4 text-sm flex items-start gap-3">
              <div className={`mt-1 flex-shrink-0 w-3 h-3 rounded-full ${record.results[i] ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="flex-1">
                <div className="font-bold">{c.front}</div>
                <div className="text-gray-600 mb-1">{c.back}</div>
                {c.note && <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded w-full">註解：{c.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-8 p-4 bg-gray-100 rounded-xl border">
        <div className="text-sm font-bold text-gray-700 mb-3">匯出功能</div>
        <div className="flex flex-col gap-2">
          {/* Note: since "export original" might mean the original imported entire deck, but we only have record.originalCards here. 
              We'll use originalCards for "original". In a real system we'd look up the real original deck from `DB_KEY_DECKS`. */}
          <button onClick={() => exportJSON(JSON.stringify({ title: record.sourceDeckTitle, cards: record.originalCards }, null, 2))} className="text-sm bg-white border py-2 rounded shadow-sm hover:bg-gray-50 text-left px-4">
            匯出本次牌組
          </button>
          <button onClick={() => exportJSON(JSON.stringify({ title: record.sourceDeckTitle + ' 錯題', cards: getMistakesCards() }, null, 2))} className="text-sm bg-white border py-2 rounded shadow-sm hover:bg-gray-50 text-left px-4">
            匯出錯題牌組
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ onStartQuiz, onGlobalBackup, onGlobalRestore, onClearHistory, onClearDecks, onShowAlert }: any) {
  const [history, setHistory] = useState<TestRecord[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);

  useEffect(() => {
    setHistory(getHistory().reverse());
    setDecks(getDecks());
  }, []);

  return (
    <div className="pb-10">
      <div className="flex justify-between gap-2 mb-6">
        <button onClick={onGlobalBackup} className="flex-1 bg-gray-800 text-white text-xs font-bold py-2 rounded shadow flex items-center justify-center gap-1"><Download size={14}/> 一鍵備份</button>
        <button onClick={onGlobalRestore} className="flex-1 bg-gray-200 text-gray-800 text-xs font-bold py-2 rounded shadow flex items-center justify-center gap-1"><Upload size={14}/> 一鍵還原</button>
      </div>

      <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">匯入的牌組</h3>
      <div className="flex flex-col gap-3 mb-6">
        {decks.length === 0 && <div className="text-sm text-gray-400">尚無匯入牌組</div>}
        {decks.map((dk, i) => (
          <div key={i} className="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <div className="font-bold truncate max-w-[200px]">{dk.title} <span className="text-xs text-gray-400 font-normal ml-1">({dk.cards.length})</span></div>
              {dk.importedAt && <div className="text-xs text-gray-400 mt-1">{dk.importedAt}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onStartQuiz(dk)} className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"><Play size={16}/></button>
              <button onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(dk, null, 2)); onShowAlert('已複製牌組');
              }} className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"><Download size={16}/></button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">測驗歷史</h3>
      <div className="flex flex-col gap-3">
        {history.length === 0 && <div className="text-sm text-gray-400">尚無測驗歷史</div>}
        {history.map(record => (
          <div key={record.id} className="bg-white border rounded-xl p-3 flex flex-col gap-2 shadow-sm text-sm">
            <div className="flex justify-between items-start">
              <span className="font-bold text-gray-800">{record.sourceDeckTitle}</span>
              <span className="text-xs text-gray-400">{record.timestamp}</span>
            </div>
            <div className="flex gap-2 text-xs text-gray-600">
              <span>共 {record.originalCards.length} 題</span>
              <span className="text-green-600">會 {Object.values(record.results).filter(v=>v).length}</span>
              <span className="text-red-600">不會 {record.originalCards.length - Object.values(record.results).filter(v=>v).length}</span>
            </div>
            <div className="flex gap-2 mt-1">
               <button onClick={() => {
                 onStartQuiz({ title: record.sourceDeckTitle, cards: record.originalCards });
               }} className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-600 rounded">重考</button>
               <button onClick={() => {
                 const mistakes = record.originalCards.filter((_, i) => !record.results[i]);
                 if(mistakes.length > 0) onStartQuiz({ title: record.sourceDeckTitle + ' 錯題', cards: mistakes });
                 else onShowAlert('本次測驗全對，無錯題可考！');
               }} className="text-xs font-semibold px-2 py-1 bg-red-50 text-red-600 rounded">考錯題</button>
               <button onClick={() => {
                 navigator.clipboard.writeText(JSON.stringify({ title: record.sourceDeckTitle, cards: record.originalCards }, null, 2)); onShowAlert('已複製測驗牌組');
               }} className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded ml-auto flex items-center gap-1"><Download size={12}/>匯出</button>
            </div>
          </div>
        ))}
      </div>
      
      {(history.length > 0 || decks.length > 0) && (
        <div className="mt-8 border-t pt-6 flex flex-col gap-3">
          {decks.length > 0 && (
            <button onClick={onClearDecks} className="w-full bg-red-100 text-red-600 hover:bg-red-200 font-bold py-3 rounded-xl shadow-sm transition flex items-center justify-center gap-2">
              <Trash2 size={18}/>一鍵刪除匯入排組
            </button>
          )}
          {history.length > 0 && (
            <button onClick={onClearHistory} className="w-full bg-red-100 text-red-600 hover:bg-red-200 font-bold py-3 rounded-xl shadow-sm transition flex items-center justify-center gap-2">
              <Trash2 size={18}/>一鍵刪除歷史紀錄
            </button>
          )}
        </div>
      )}
    </div>
  );
}
