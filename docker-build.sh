#!/bin/bash

# 优化的 Docker 构建脚本

set -e

# 配置
IMAGE_NAME="${IMAGE_NAME:-bulita}"
TAG="${TAG:-latest}"
REGISTRY="${REGISTRY:-}"
DOCKER_BUILDKIT=1

# 使用 BuildKit 加速构建
export DOCKER_BUILDKIT=1

# 检查是否使用了 registry
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME:$TAG"
else
    FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"
fi

echo "🏗️  开始构建镜像: $FULL_IMAGE_NAME"
echo "📦 使用 BuildKit 加速构建"

# 构建镜像
docker build \
    --tag "$FULL_IMAGE_NAME" \
    --file Dockerfile \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from "$FULL_IMAGE_NAME" \
    .

echo "✅ 构建完成: $FULL_IMAGE_NAME"

# 如果有 registry，推送镜像
if [ -n "$REGISTRY" ]; then
    echo "📤 推送镜像到: $REGISTRY"
    docker push "$FULL_IMAGE_NAME"
    echo "✅ 推送完成"
fi

# 显示镜像大小
echo ""
echo "📊 镜像信息:"
docker images "$FULL_IMAGE_NAME" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
