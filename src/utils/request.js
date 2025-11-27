// src/utils/request.js
import axios from 'axios';
import { message } from 'antd';

// 创建 axios 实例
const request = axios.create({
  // 注意：这里匹配你的 Django 端口，且加上 /api 前缀
  baseURL: 'http://localhost:8000/api', 
  timeout: 5000,
});

// 请求拦截器：每次发请求前，自动带上 Token
request.interceptors.request.use(
  (config) => {
    // 从 Auth.jsx 存的地方取 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：统一处理错误
request.interceptors.response.use(
  (response) => {
    return response.data; // 直接返回数据部分
  },
  (error) => {
    if (error.response) {
      // 如果是 401 说明 Token 过期或未登录
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        // 可选：这里可以触发强制登出逻辑，目前先刷新页面
        // window.location.reload(); 
      }
      message.error(error.response.data.detail || '请求失败');
    } else {
      message.error('网络连接异常');
    }
    return Promise.reject(error);
  }
);

export default request;