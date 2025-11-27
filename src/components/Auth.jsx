import React, { useState } from 'react';
import { Form, Input, Button, Modal, message } from 'antd';
// 引入我们封装好的请求工具
import request from '../utils/request'; 

const Auth = ({ isVisible, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false); // 增加一个 loading 状态，体验更好
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      if (isLogin) {
        // --- 登录逻辑 ---
        // request.post 会自动拼接 baseURL，所以只写 '/token/' 即可
        const data = await request.post('/token/', values);
        
        // request.js 的拦截器已经帮我们把 response.data 提取出来了
        // 直接存 token
        localStorage.setItem('token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        
        message.success('登录成功');
        onSuccess(values.username); // 通知父组件登录成功
      } else {
        // --- 注册逻辑 ---
        await request.post('/register/', values); // 假设后端注册接口是 /api/register/
        
        message.success('注册成功，请登录');
        setIsLogin(true); // 切换回登录页
        form.resetFields();
      }
    } catch (error) {
      // 错误提示已经在 request.js 里统一处理了，这里可以不再写 message.error
      // 或者针对特定错误做额外处理
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isLogin ? "登录" : "注册"}
      open={isVisible}
      onCancel={onClose}
      footer={null}
      closable={true}
      maskClosable={false}
      destroyOnClose
    >
      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="请输入用户名" />
        </Form.Item>
        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password placeholder="请输入密码" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {isLogin ? "登录" : "注册"}
          </Button>
        </Form.Item>
        <Button
          type="link"
          block
          onClick={() => {
            setIsLogin(!isLogin);
            form.resetFields();
          }}
        >
          {isLogin ? "没有账号？去注册" : "已有账号？去登录"}
        </Button>
      </Form>
    </Modal>
  );
};

export default Auth;