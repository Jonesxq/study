# 部署说明

1. 在域名 DNS 控制台中添加 A 记录：`weixianmanbu.shop -> 115.29.175.216`。
2. 在服务器开放 80 和 443 端口。
3. 安装 Docker 和 Docker Compose。需要 Docker Compose v2.24 或更新版本，以支持可选 `.env` 文件校验。
4. 上传代码到服务器。
5. 复制环境变量文件：

```bash
cp .env.example .env
```

6. 编辑 `.env`，填写管理员密码和飞书应用凭证。必须修改 `ADMIN_PASSWORD` 为强密码。
   `FEISHU_SYNC_SOURCE` 可填写 `space_id`，或填写 `space_id:parent_node_token` 指定父节点。
   上传图片会持久化在宿主 `./uploads`，容器内路径为 `/app/public/uploads/feishu`。
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

## 服务器准备

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

## 发布检查

- DNS A 记录已经指向 `115.29.175.216`。
- 服务器 80 和 443 端口已开放。
- `.env` 已填写强密码和飞书凭证。
- `docker compose up -d --build` 成功。
- `docker compose ps` 显示 `app` 和 `proxy` 都在运行。
- `curl https://weixianmanbu.shop/api/health` 返回 `{"ok":true}`。
- 后台 `/admin/login` 可以打开。
- 首次手动飞书同步已成功或后台能看到中文失败原因。
