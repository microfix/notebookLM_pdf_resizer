FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Install serve to run the application
RUN npm install -g serve

# Expose port (Coolify uses 3000 by default for Node)
EXPOSE 3000

# Start command
CMD ["serve", "-s", "dist", "-l", "3000"]
