# Video2Skill web app (Next.js). For Vercel deployment you do NOT need Docker —
# this image is only for self-hosting the web tier. The heavy video processing
# runs in a separate container (see Dockerfile.worker).
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts /app/tsconfig.json ./
COPY --from=builder /app/app ./app
COPY --from=builder /app/src ./src
EXPOSE 3000
CMD ["npm", "start"]
