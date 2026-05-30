# 部署说明

1. 在域名 DNS 控制台中添加 A 记录：`weixianmanbu.shop -> 115.29.175.216`。
2. 在服务器开放 80 和 443 端口。
3. 安装 Docker 和 Docker Compose。
4. 上传代码到服务器。
5. 复制环境变量文件：

```bash
cp .env.example .env
```

6. 编辑 `.env`，填写管理员密码和飞书应用凭证。
7. 启动服务：

```bash
docker compose up -d --build
```

8. 创建管理员：

```bash
docker compose exec app npm run seed:admin
```

9. 查看健康检查：

```bash
curl https://weixianmanbu.shop/api/health
```

10. 手动同步飞书：

```bash
docker compose exec app npm run sync:feishu
```
