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

# Expose port (Coolify expects 80)
EXPOSE 80

# Start command
CMD ["serve", "-s", "dist", "-l", "80"]
