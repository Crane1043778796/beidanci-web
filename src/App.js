import React, { useState, useEffect, useCallback, useRef } from 'react';
import WordMemo from './components/WordMemo';
import request from './utils/request';
import {
  Layout,
  Dropdown,
  Button,
  message,
  Input,
  Table,
  Tabs,
  Tag,
  Space,
  Modal,
  Form,
  Radio,
  AutoComplete,
  Empty,
  Spin,
  Typography
} from 'antd';
import { 
  UserOutlined, 
  SearchOutlined, 
  ReadOutlined, 
  UnorderedListOutlined, 
  CheckCircleOutlined, 
  RightOutlined,
  SoundOutlined,
  LoadingOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import 'antd/dist/reset.css';
import { Resizable } from 'react-resizable';
import './App.css';

const { Header, Content } = Layout;

// --- 全局辅助函数 ---

const debounce = (func, wait) => {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
};

const highlightText = (str) => {
  if (!str) return '';
  return str.replace(
    /\*([^*]+)\*/g,
    '<span style="color: #1890ff; font-weight: bold; padding: 0 4px;">$1</span>'
  );
};

// --- App 主组件 ---
const App = () => {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('username') || null);
  const [view, setView] = useState('list'); 

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    setCurrentUser(null);
    setView('list');
  };

  const handleUserLogin = (username) => {
    localStorage.setItem('username', username);
    setCurrentUser(username);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f6f8fa' }}>
      <Header
        style={{
          background: '#1890ff',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 10,
          height: 'auto',
          minHeight: 70, 
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap', 
            padding: '12px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <h1 style={{ color: 'white', margin: 0, fontSize: '26px', letterSpacing: 1, whiteSpace: 'nowrap', fontWeight: 600 }}>
              Sisyphus
            </h1>
            
            {currentUser && (
              <Radio.Group 
                value={view} 
                onChange={(e) => setView(e.target.value)} 
                buttonStyle="solid"
                size="large"
              >
                <Radio.Button value="list">
                  <UnorderedListOutlined /> 列表
                </Radio.Button>
                <Radio.Button value="review">
                  <ReadOutlined /> 背诵
                </Radio.Button>
              </Radio.Group>
            )}
          </div>

          {currentUser && (
            <Dropdown
              menu={{
                items: [{ key: 'logout', label: '退出登录', onClick: handleLogout }],
              }}
            >
              <Button type="text" style={{ color: 'white', fontSize: 20, fontWeight: 500 }}>
                <UserOutlined /> {currentUser}
              </Button>
            </Dropdown>
          )}
        </div>
      </Header>
      <Content
        style={{
          background: '#f6f8fa',
          padding: '32px 16px',
          display: 'flex',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 70px)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1600,
            minHeight: 600,
            background: view === 'review' ? 'transparent' : '#fff', 
            borderRadius: 24,
            boxShadow: view === 'review' ? 'none' : '0 8px 40px rgba(0,0,0,0.06)',
            padding: view === 'review' ? '0' : '40px', 
          }}
        >
          {!currentUser ? (
            <WordMemo
              onUserLogin={handleUserLogin}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              key="auth"
            />
          ) : view === 'list' ? (
            <SearchPage />
          ) : (
            <ReviewMode />
          )}
        </div>
      </Content>
    </Layout>
  );
};

// =======================
// === 核心组件：背诵模式 ===
// =======================
function ReviewMode() {
  const [reviewQueue, setReviewQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false); 
  const [finished, setFinished] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); 

  // === 语音合成 ===
  const speak = useCallback((text) => {
    if (!text) return;
    
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (/[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fa5]/.test(cleanText)) {
      utterance.lang = 'ja-JP'; 
    } else {
      utterance.lang = 'en-US';
    }

    utterance.rate = 0.9; 
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const fetchAndPrepare = async () => {
    setLoading(true);
    try {
      const res = await request.get('/words/');
      const list = res
        .filter(item => item.events.length > 0 && item.sentenceMarkdown)
        .sort((a, b) => b.events.length - a.events.length);
      
      setReviewQueue(list);
      setFinished(false);
      setCurrentIndex(0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndPrepare();
  }, []);

  useEffect(() => {
    if (!loading && !finished && reviewQueue.length > 0) {
      const item = reviewQueue[currentIndex];
      const allGroups = (item.sentenceMarkdown || '').split('\n\n---\n\n');
      const latestGroup = allGroups[allGroups.length - 1];
      const lines = latestGroup.split('\n');
      const foreignSentence = lines[0] || ''; 
      
      const timer = setTimeout(() => {
        speak(foreignSentence);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, loading, finished, reviewQueue, speak]);

  const handleMinusOne = async () => {
    const currentItem = reviewQueue[currentIndex];
    const newEvents = [...currentItem.events];
    newEvents.pop(); 

    try {
      await request.patch(`/words/${currentItem.id}/`, { events: newEvents });
      message.success('熟练度 -1');
      nextCard();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const nextCard = () => {
    setExpanded(false); 
    window.speechSynthesis.cancel();
    setIsPlaying(false);

    setTimeout(() => {
      if (currentIndex < reviewQueue.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setFinished(true);
      }
    }, 300);
  };

  const handleManualPlay = (e, text) => {
    e.stopPropagation(); 
    speak(text);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, fontSize: 20 }}>加载复习队列...</div>;

  if (reviewQueue.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100, padding: 20 }}>
        <Empty description={<span style={{fontSize: 20}}>太棒了！当前没有积压的单词需要复习</span>} />
        <Button size="large" type="primary" onClick={fetchAndPrepare} style={{ marginTop: 30, height: 50, fontSize: 20 }}>
          刷新试试
        </Button>
      </div>
    );
  }

  if (finished) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100, padding: 20 }}>
        <CheckCircleOutlined style={{ fontSize: 80, color: '#52c41a' }} />
        <h2 style={{ marginTop: 30, fontSize: 32 }}>本次复习完成！</h2>
        <Button size="large" type="primary" onClick={fetchAndPrepare} style={{marginTop: 20, height: 50, fontSize: 20}}>再来一轮</Button>
      </div>
    );
  }

  const item = reviewQueue[currentIndex];
  const allGroups = (item.sentenceMarkdown || '').split('\n\n---\n\n');
  const latestGroup = allGroups[allGroups.length - 1];
  const lines = latestGroup.split('\n');
  const foreignSentence = lines[0] || '暂无例句'; 
  const chineseTranslation = lines.slice(1).join('<br/>') || '暂无翻译'; 

  return (
    <div className="review-container">
      <div className="review-progress">
        当前进度: {currentIndex + 1} / {reviewQueue.length} (次数: {item.events.length})
      </div>

      <div 
        className={`review-card ${expanded ? 'expanded' : ''}`} 
        onClick={() => !expanded && setExpanded(true)}
      >
        <div className="card-question">
          <div 
            className="question-text" 
            dangerouslySetInnerHTML={{ __html: highlightText(foreignSentence) }} 
          />
          
          <div 
            className={`sound-btn ${isPlaying ? 'playing' : ''}`}
            onClick={(e) => handleManualPlay(e, foreignSentence)}
            title="重听例句"
          >
            <SoundOutlined />
          </div>

          {!expanded && <div className="tap-hint">点击查看释义</div>}
        </div>

        <div className="card-answer">
          <div 
            className="answer-translation"
            dangerouslySetInnerHTML={{ __html: highlightText(chineseTranslation) }}
          />
          
          <div className="answer-word-info">
            <div className="answer-word">{item.word}</div>
            <div className="answer-meaning">{item.meaning}</div>
          </div>

          <div className="action-area">
            <Button 
              type="primary" 
              className="big-btn"
              icon={<CheckCircleOutlined />} 
              onClick={(e) => { e.stopPropagation(); handleMinusOne(); }}
            >
              我想起来了 (-1)
            </Button>
            
            <Button 
              className="big-btn"
              icon={<RightOutlined />}
              onClick={(e) => { e.stopPropagation(); nextCard(); }}
            >
              下一个
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =======================
// === 列表管理组件 (SearchPage) ===
// =======================
function SearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('recent');
  
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [data, setData] = useState([]);
  const [searchOptions, setSearchOptions] = useState([]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [addMode, setAddMode] = useState('word');
  const [form] = Form.useForm();
  
  const [translatingSentence, setTranslatingSentence] = useState(false);
  
  const sentenceInputRef = useRef(null);

  const now = Date.now();
  const withinDays = (item, days) =>
    item.events.filter((ts) => now - new Date(ts).getTime() <= days * 24 * 60 * 60 * 1000).length;

  const countByTab = (item) => {
    const tab = activeTabRef.current;
    switch (tab) {
      case 'day': return withinDays(item, 1);
      case 'week': return withinDays(item, 7);
      case 'all': return item.events.length;
      case 'recent': return item.events.length;
      default: return item.events.length;
    }
  };

  const colorByCount = (c) => {
    if (c >= 8) return 'red';
    if (c >= 4) return 'orange';
    if (c >= 1) return 'blue';
    return 'default';
  };

  const fetchList = async () => {
    try {
      const res = await request.get('/words/');
      setData(res);
    } catch (error) { console.error(error); }
  };
  useEffect(() => { fetchList(); }, []);
  
  const remarkOptions = [...new Set(data.map(item => item.remark).filter(Boolean))].map(r => ({ value: r }));
  
  const handlePlusOne = async (item) => {
    const newEvents = [...item.events, new Date()];
    await request.patch(`/words/${item.id}/`, { events: newEvents });
    message.success(`"${item.word}" +1`);
    fetchList();
  };

  const debouncedSearch = useRef(debounce(async (value) => {
    if (!value) { setSearchOptions([]); return; }
    try {
      const res = await request.get(`/words/?search=${value}`);
      setSearchOptions(res.slice(0,10).map(item => ({ value: item.word, label: item.word, fullItem: item })));
    } catch (e) {}
  }, 500)).current;

  const handleSearchChange = (value) => { setQuery(value); debouncedSearch(value); };
  const handleSelect = (value, option) => { if(option.fullItem) handlePlusOne(option.fullItem); };
  
  const filtered = data.filter(item => !query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
        if (activeTab === 'recent') return new Date(b.updatedAt) - new Date(a.updatedAt);
        return countByTab(b) - countByTab(a);
    });

  const [columns, setColumns] = useState([
    {
      title: '次数',
      key: 'count',
      align: 'center',
      render: (_, item) => {
        const c = countByTab(item);
        return <Tag className="count-tag" color={colorByCount(c)}>{c}</Tag>;
      },
      width: 100,
    },
    { 
      title: '单词 / 语法', 
      dataIndex: 'word', 
      key: 'word', 
      width: 200,
      render: (text) => <div className="cell-word">{text}</div>
    },
    { 
      title: '意思', 
      dataIndex: 'meaning', 
      key: 'meaning', 
      width: 250,
      render: (text) => <div className="cell-meaning">{text}</div>
    },
    {
      title: '例句',
      dataIndex: 'sentenceMarkdown',
      key: 'sentenceMarkdown',
      render: (text) => {
        if (!text) return null;
        const allGroups = text.split('\n\n---\n\n');
        const latestGroup = allGroups[allGroups.length - 1];
        const parts = latestGroup.split('\n');
        const mainSentence = parts[0];
        const translation = parts.slice(1).join(' ');
        
        return (
          <div className="cell-sentence" style={{ display: 'flex', flexDirection: 'column' }}>
            <div 
              style={{ fontWeight: '500', color: '#333', marginBottom: 4 }} 
              dangerouslySetInnerHTML={{ __html: highlightText(mainSentence) }} 
            />
            {translation && (
              <div 
                style={{ color: '#888', fontStyle: 'normal' }} 
                dangerouslySetInnerHTML={{ __html: highlightText(translation) }} 
              />
            )}
            {allGroups.length > 1 && (
              <Tag color="blue" style={{width: 'fit-content', marginTop: 4, cursor: 'pointer'}}>
                +{allGroups.length - 1} 更多例句
              </Tag>
            )}
          </div>
        );
      },
    },
    { 
      title: '备注', 
      dataIndex: 'remark', 
      key: 'remark', 
      width: 150,
      render: (text) => <div className="cell-remark">{text}</div>
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      align: 'center',
      render: (_, item) => (
        <Space size="middle">
          <Button
            size="large"
            disabled={item.events.length === 0}
            onClick={async (e) => {
              e.stopPropagation();
              const newEvents = [...item.events];
              newEvents.pop();
              try {
                await request.patch(`/words/${item.id}/`, { events: newEvents });
                message.success('-1');
                fetchList();
              } catch (e) { }
            }}
          >
            -1
          </Button>

          <Button size="large" onClick={(e) => { e.stopPropagation(); handlePlusOne(item); }}>+1</Button>

          <Button
            size="large"
            onClick={(e) => {
              e.stopPropagation();
              form.setFieldsValue({
                word: item.word,
                meaning: item.meaning,
                sentenceMarkdown: item.sentenceMarkdown,
                remark: item.remark,
              });
              setAddMode(item.type === 'sentence' ? 'sentence' : 'word');
              setModalOpen(true);
              form.__editingId = item.id;
            }}
          >
            改
          </Button>

          <Button
            danger
            size="large"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await request.delete(`/words/${item.id}/`);
                message.success('删');
                fetchList();
              } catch (e) { }
            }}
          >
            删
          </Button>
        </Space>
      ),
    },
  ]);

  const handleResize = useCallback((index) => (e, { size }) => {
    setColumns((cols) => {
      const nextCols = [...cols];
      nextCols[index] = { ...nextCols[index], width: size.width };
      return nextCols;
    });
  }, []);

  const mergedColumns = columns.map((col, index) => ({
    ...col,
    onHeaderCell: (column) => ({
      width: col.width,
      onResize: handleResize(index),
    }),
  }));

  const components = {
    header: { cell: ResizableTitle },
  };

  function ResizableTitle(props) {
    const { onResize, width, ...restProps } = props;
    if (!width) return <th {...restProps} />;
    return (
      <Resizable
        width={width}
        height={0}
        handle={<span className="react-resizable-handle" onClick={e => e.stopPropagation()} style={{position:'absolute',right:0,top:0,bottom:0,width:10,cursor:'col-resize',zIndex:1}} />}
        onResize={onResize}
        draggableOpts={{ enableUserSelectHack: false }}
      >
        <th {...restProps} />
      </Resizable>
    );
  }

  // 1. 查单词原型 (只在 Ctrl+B 时调用)
  const fetchRootWord = async (word) => {
    if (!word) return;
    try {
      // mode=prototype 表示只查原型，不查意思
      const res = await request.get(`/dictionary/?word=${word}&mode=prototype`);
      
      if (res.root_word && res.root_word !== word) {
        form.setFieldsValue({ word: res.root_word });
        message.info(`自动转为原型: ${res.root_word}`);
      }
    } catch (error) { console.error(error); } 
  };

  // 2. 整句翻译
  const translateSentence = async (sentence) => {
    if (!sentence) return;
    setTranslatingSentence(true);
    try {
      const res = await request.get(`/dictionary/?word=${sentence}&mode=translate`);
      if (res.meaning) {
        const currentVal = form.getFieldValue('sentenceMarkdown') || '';
        const newVal = currentVal.trim() + '\n' + res.meaning;
        form.setFieldsValue({ sentenceMarkdown: newVal });
        message.success('整句翻译已追加');
      }
    } catch (error) { console.error(error); }
    finally { setTranslatingSentence(false); }
  };

  // 3. 监听键盘
  const handleSentenceKeyDown = (e) => {
    // 回车 -> 翻译
    if (e.key === 'Enter') {
      if (e.shiftKey) return; 

      e.preventDefault(); 
      const textArea = e.target;
      const fullText = textArea.value;
      
      const lines = fullText.split('\n');
      const lastLine = lines[lines.length - 1];

      if (lastLine) {
        translateSentence(lastLine);
      }
    }
    // Ctrl+B -> 加粗 + 填词 + 查原型
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const textArea = e.target;
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const value = textArea.value;

      if (start === end) {
        message.warning('请先选中文字');
        return;
      }

      const selectedText = value.substring(start, end);
      
      // 1. 修改例句加粗
      const newValue = value.substring(0, start) + `*${selectedText}*` + value.substring(end);
      form.setFieldsValue({ sentenceMarkdown: newValue });

      // 2. 填入单词框
      form.setFieldsValue({ word: selectedText });

      // 3. 查原型 (如果有变形)
      fetchRootWord(selectedText);
    }
  };

  // 4. 监听鼠标选词 (只填空，不查词)
  const handleSentenceSelect = (e) => {
    const textArea = e.target;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const value = textArea.value;
    
    if (start !== end) {
      const selectedText = value.substring(start, end);
      const firstNewLineIndex = value.indexOf('\n');

      // 选中第一行 -> 填单词框 (手动)
      if (firstNewLineIndex === -1 || end <= firstNewLineIndex) {
        form.setFieldsValue({ word: selectedText });
      } 
      // 选中第二行 -> 填意思框 (手动)
      else if (start > firstNewLineIndex) {
        form.setFieldsValue({ meaning: selectedText });
      }
    }
  };

  const openAddModal = () => {
    form.resetFields();
    form.__editingId = null;
    setAddMode('word');
    setModalOpen(true);
    const lastRemark = localStorage.getItem('last_remark_used');
    if (lastRemark) form.setFieldsValue({ remark: lastRemark });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let payload = { ...values, type: 'word' }; 
      if (values.remark) localStorage.setItem('last_remark_used', values.remark);

      if (form.__editingId) {
        await request.patch(`/words/${form.__editingId}/`, payload);
        message.success('修改成功');
      } else {
        // 新增时自动增加一次复习记录
        await request.post('/words/', { ...payload, events: [new Date()] });
        message.success('新增成功');
      }
      setModalOpen(false);
      fetchList();
    } catch (e) {
      console.error(e);
    }
  };

  // 展开逻辑
  const expandedRowRender = (record) => {
    if (!record.sentenceMarkdown) return null;
    const allGroups = record.sentenceMarkdown.split('\n\n---\n\n');
    
    return (
      <div style={{ padding: '20px 30px', background: '#f9f9f9', borderRadius: 8 }}>
        <h4 style={{ marginBottom: 16, color: '#1890ff', fontWeight: 'bold' }}>所有例句 ({allGroups.length})</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {allGroups.map((group, idx) => {
            const parts = group.split('\n');
            const main = parts[0];
            const trans = parts.slice(1).join(' ');
            return (
              <div key={idx} style={{ borderLeft: '4px solid #1890ff', paddingLeft: 16, paddingBottom: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: highlightText(main) }} />
                <div style={{ fontSize: 16, color: '#666' }} dangerouslySetInnerHTML={{ __html: highlightText(trans) }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="main-content" style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <div className="search-bar-wrapper">
        <div className="search-bar">
          <div className="custom-search-group">
            <AutoComplete
              className="custom-autocomplete"
              style={{ flex: 1, height: '100%' }}
              options={searchOptions}
              onSelect={handleSelect}
              onSearch={handleSearchChange}
              value={query}
              popupMatchSelectWidth={400} 
            >
              <Input
                placeholder="搜索单词、意思、例句..."
                onPressEnter={() => setSearchOptions([])}
              />
            </AutoComplete>
            <Button
              type="primary"
              className="custom-search-btn"
              onClick={() => handleSearchChange(query)}
            >
              <SearchOutlined />
            </Button>
          </div>
          <Button type="primary" className="custom-add-btn" onClick={openAddModal}>
            新增
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Tabs
          className="main-tabs"
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            activeTabRef.current = key;
          }}
          items={[
            { key: 'day', label: '本日' },
            { key: 'week', label: '本周' },
            { key: 'all', label: '历史' },
            { key: 'recent', label: '最近' },
          ]}
          tabBarStyle={{ fontWeight: 500, marginBottom: 0 }}
        />
      </div>
      
      <Table
        className="main-table"
        rowKey="id"
        columns={mergedColumns}
        dataSource={filtered}
        pagination={{ pageSize: 15 }} 
        components={components}
        scroll={{ x: 1000 }} 
        style={{
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
        size="large"
        expandable={{
          expandedRowRender,
          rowExpandable: record => record.sentenceMarkdown && record.sentenceMarkdown.includes('\n\n---\n\n'),
          expandRowByClick: true, 
        }}
      />

      <Modal
        title={form.__editingId ? '修改条目' : '极速录入'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        destroyOnClose
        width={800} 
        bodyStyle={{ padding: '24px' }}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            name="sentenceMarkdown" 
            label={
              <Space>
                <span style={{fontSize: 18, fontWeight: 'bold'}}>1. 先写例句</span>
                <Tag color="blue">Enter 翻译</Tag>
                <Tag color="green">鼠标选词 → 填空</Tag>
                <Tag color="volcano">Ctrl+B → 加粗并查原型</Tag>
                {translatingSentence && <Spin indicator={<LoadingOutlined />} />}
              </Space>
            }
            rules={[{ required: true, message: '请输入例句' }]}
          >
            <Input.TextArea 
              ref={sentenceInputRef} 
              onKeyDown={handleSentenceKeyDown} 
              onSelect={handleSentenceSelect}   
              rows={3} 
              placeholder="例如：昼過ぎだったんだ。(写完按回车，然后用鼠标选中 '昼過ぎ')" 
              style={{ fontSize: '20px', lineHeight: '1.6' }}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: 24 }}>
            <Form.Item 
              name="word" 
              label="2. 单词 (选中第一行自动填)" 
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <Input size="large" style={{ fontSize: 18 }} />
            </Form.Item>

            <Form.Item 
              name="meaning" 
              label="3. 意思 (选中第二行自动填)"
              style={{ flex: 1.5 }}
              rules={[{ required: true }]}
            >
              <Input 
                size="large" 
                style={{ fontSize: 18 }} 
                suffix={<ThunderboltOutlined style={{color: '#faad14'}} />}
              />
            </Form.Item>
          </div>

          <Form.Item name="remark" label="备注">
            <AutoComplete options={remarkOptions}>
                <Input size="large" placeholder="如：N1语法" />
            </AutoComplete>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default App;