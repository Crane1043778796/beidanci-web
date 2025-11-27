import React, { useState, useEffect } from 'react';
import { Button, Card, Form, Input, Select, Modal, List, Tag, Collapse, message, Dropdown, Popconfirm } from 'antd';
import { UserOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Auth from './Auth';


const { Option } = Select;
const { Panel } = Collapse;

const WordMemo = ({ onUserLogin, currentUser, setCurrentUser }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAuthVisible, setIsAuthVisible] = useState(true);
  const [form] = Form.useForm();
  const [words, setWords] = useState([]);
  const [activeCardId, setActiveCardId] = useState(null);
  // 添加这三行到组件内部
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingWord, setEditingWord] = useState(null);
  const [editForm] = Form.useForm();

  // 添加 handleEdit 函数到组件内部
  const handleEdit = async (values) => {
    try {
      const response = await fetch(`http://8.133.246.122:8000/api/words/${editingWord.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const updatedWord = await response.json();
        setWords(words.map(w => w.id === editingWord.id ? updatedWord : w));
        setIsEditModalVisible(false);
        message.success('修改成功');
      }
    } catch (error) {
      message.error('修改失败');
    }
  };

  const handleDelete = async (wordId) => {
    try {
      const response = await fetch(`http://8.133.246.122:8000/api/words/${wordId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        setWords(words.filter(word => word.id !== wordId));
        message.success('删除成功');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleCardClick = (wordId) => {
    setActiveCardId(activeCardId === wordId ? null : wordId);
  };

  // 删除 handleLogout 函数
  // 删除退出登录按钮
  const getCategoryColor = (category) => {
    const colors = {
      '名词': 'blue',
      '动词': 'green',
      '形容词': 'purple',
      '副词': 'orange',
      '其他': 'gray'
    };
    return colors[category] || 'blue';
  };

  // 按日期分组
  const groupedWords = words.reduce((groups, word) => {
    if (!groups[word.date]) {
      groups[word.date] = [];
    }
    groups[word.date].push(word);
    return groups;
  }, {});

  // 排序日期
  const sortedDates = Object.keys(groupedWords).sort((a, b) => dayjs(b).diff(dayjs(a)));

  const handleSubmit = async (values) => {
    try {
      const now = dayjs();
      const newWord = {
        ...values,
        date: now.format('YYYY-MM-DD'),
        time: now.format('HH:mm')
      };
  
      const response = await fetch('http://8.133.246.122:8000/api/words/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newWord),
      });
  
      if (response.ok) {
        const data = await response.json();
        setWords([data, ...words]);
        // 保存当前的种类
        const currentCategory = values.category;
        // 重置表单，但保留种类
        form.resetFields();
        form.setFieldsValue({ category: currentCategory });
        message.success('添加成功');
      }
    } catch (error) {
      message.error('添加失败');
    }
  };

  const fetchWords = async () => {
    try {
      const response = await fetch('http://8.133.246.122:8000/api/words/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setWords(data);
      } else if (response.status === 401) {
        // Token 过期或无效，需要重新登录
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        setCurrentUser(null);
      }
    } catch (error) {
      message.error('获取单词列表失败');
    }
};

  useEffect(() => {
    if (currentUser) {
      fetchWords();
    }
  }, [currentUser]);

  const handleAuthSuccess = (username) => {
    setIsAuthVisible(false);
    onUserLogin(username);  // This will update the user state in App.js
  };

  // Remove handleLogout function since it's now in App.js

  // 如果没有登录，显示登录界面
  if (!currentUser) {
    return (
      <Auth 
        isVisible={isAuthVisible}
        onClose={() => {}}
        onSuccess={handleAuthSuccess}
      />
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <Button 
          type="primary" 
          onClick={() => setIsModalVisible(true)}
          size="large"
        >
          添加新单词
        </Button>
      </div>
      
      <Collapse>
        {sortedDates.map(date => (
          <Panel 
            header={
              <div style={{
                textAlign: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                padding: '8px 0'
              }}>
                {dayjs(date).format('YYYY年MM月DD日')}
              </div>
            }
            key={date}
            style={{ marginBottom: '16px', background: '#fff' }}
          >
            <List
              grid={{ gutter: 16, column: 1 }}
              dataSource={groupedWords[date]}
              renderItem={word => (
                <List.Item>
                  <Card 
                    hoverable 
                    style={{ marginBottom: '16px', padding: '20px', position: 'relative' }}
                    bodyStyle={{ padding: '0' }}
                    onClick={() => handleCardClick(word.id)}
                  >
                    <div 
                      className="delete-button" 
                      style={{
                        position: 'absolute',
                        right: '20px',
                        top: '20px',
                        opacity: activeCardId === word.id ? 1 : 0,
                        transition: 'opacity 0.3s',
                        zIndex: 1,
                        display: 'flex',
                        gap: '10px'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button 
                        type="text" 
                        style={{ color: '#1890ff' }}
                        icon={<EditOutlined />}
                        onClick={() => {
                          setEditingWord(word);
                          editForm.setFieldsValue(word);
                          setIsEditModalVisible(true);
                        }}
                      />
                      <Popconfirm
                        title="确定要删除这个单词吗？"
                        onConfirm={() => {
                          handleDelete(word.id);
                          setActiveCardId(null);
                        }}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button 
                          type="text" 
                          danger 
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      position: 'relative',
                      minHeight: '280px',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1
                      }}>
                        <h2 style={{ 
                          fontSize: '50px',
                          fontWeight: 'bold',
                          margin: 0
                        }}>{word.word}</h2>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                      }}>
                        <p style={{ 
                          fontSize: '22px',
                          color: '#333',
                          textAlign: 'center',
                          margin: 0
                        }}>{word.meaning}</p>
                        <p style={{ 
                          color: '#666', 
                          fontSize: '18px',
                          textAlign: 'center',
                          margin: 0
                        }}>{word.sentence}</p>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        marginTop: '20px'
                      }}>
                        <Tag color={getCategoryColor(word.category)} style={{ fontSize: '14px' }}>
                          {word.category}
                        </Tag>
                        <span style={{ color: '#999', fontSize: '14px' }}>
                          {word.time || dayjs(word.date).format('HH:mm')}  {/* 使用新的时间字段 */}
                        </span>
                      </div>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          </Panel>
        ))}
      </Collapse>

      {/* 添加新单词的模态框 */}
      <Modal
        title="添加新单词"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
      
        <Form 
          form={form} 
          onFinish={handleSubmit} 
          layout="vertical" 
          size="large"
          style={{ fontSize: '20px' }}
        > 
          <Form.Item 
            name="word" 
            label={<span style={{ fontSize: '20px' }}>单词</span>} 
            rules={[{ required: true }]}
          >
            <Input 
              placeholder="请输入单词" 
              style={{ fontSize: '20px' }} 
              onPressEnter={(e) => {
                e.preventDefault();
                form.getFieldInstance('meaning').focus();
              }}
            />
          </Form.Item>
          <Form.Item 
            name="meaning" 
            label={<span style={{ fontSize: '20px' }}>含义</span>} 
            rules={[{ required: true }]}
          >
            <Input 
              placeholder="请输入含义" 
              style={{ fontSize: '20px' }} 
              onPressEnter={(e) => {
                e.preventDefault();
                form.getFieldInstance('sentence').focus();
              }}
            />
          </Form.Item>
          <Form.Item 
            name="sentence" 
            label={<span style={{ fontSize: '20px' }}>例句</span>}
          >
            <Input.TextArea 
              placeholder="请输入例句" 
              style={{ fontSize: '20px' }} 
              autoSize={{ minRows: 3, maxRows: 6 }}
              onPressEnter={(e) => {
                e.preventDefault();
                form.getFieldInstance('category').focus();
              }}
            />
          </Form.Item>
          <Form.Item 
            name="category" 
            label={<span style={{ fontSize: '20px' }}>种类</span>} 
            rules={[{ required: true }]}
          >
            <Select 
              placeholder="请选择种类" 
              style={{ fontSize: '20px' }}
              dropdownStyle={{ fontSize: '20px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && form.getFieldValue('category')) {
                  e.preventDefault();
                  form.submit();
                }
              }}
            >
              {['日语', '韩语'].map(cat => (
                <Option key={cat} value={cat} style={{ fontSize: '20px' }}>{cat}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加编辑模态框 */}
      <Modal
        title="修改单词"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <Form 
          form={editForm} 
          onFinish={handleEdit} 
          layout="vertical" 
          size="large"
          style={{ fontSize: '20px' }}
        > 
          <Form.Item 
            name="word" 
            label={<span style={{ fontSize: '20px' }}>单词</span>} 
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入单词" style={{ fontSize: '20px' }} />
          </Form.Item>
          <Form.Item 
            name="meaning" 
            label={<span style={{ fontSize: '20px' }}>含义</span>} 
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入含义" style={{ fontSize: '20px' }} />
          </Form.Item>
          <Form.Item 
            name="sentence" 
            label={<span style={{ fontSize: '20px' }}>例句</span>}
          >
            <Input.TextArea 
              placeholder="请输入例句" 
              style={{ fontSize: '20px' }} 
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </Form.Item>
          <Form.Item 
            name="category" 
            label={<span style={{ fontSize: '20px' }}>种类</span>} 
            rules={[{ required: true }]}
          >
            <Select 
              placeholder="请选择种类" 
              style={{ fontSize: '20px' }}
              dropdownStyle={{ fontSize: '20px' }}
            >
              {['日语', '韩语'].map(cat => (
                <Option key={cat} value={cat} style={{ fontSize: '20px' }}>{cat}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" style={{ fontSize: '20px', height: 'auto', padding: '10px' }}>
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WordMemo;