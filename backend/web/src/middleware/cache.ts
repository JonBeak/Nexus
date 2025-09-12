// Cache middleware for optimized API responses - Phase 3
// Reduces database queries and improves response times

import { Request, Response, NextFunction } from 'express';

interface CacheOptions {
  ttl: number; // Time to live in seconds
  key?: (req: Request) => string; // Custom cache key generator
  condition?: (req: Request) => boolean; // Condition to determine if response should be cached
}

// In-memory cache store (in production, use Redis)
const cache = new Map<string, {
  data: any;
  timestamp: number;
  ttl: number;
}>();

// Cache cleanup interval (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > value.ttl * 1000) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const cacheMiddleware = (options: CacheOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check if caching condition is met
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = options.key ? 
      options.key(req) : 
      `${req.originalUrl}-${JSON.stringify(req.query)}`;

    // Check if cached data exists and is still valid
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < cached.ttl * 1000)) {
      return res.json(cached.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data: any) {
      // Cache successful responses only
      if (res.statusCode === 200) {
        cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl: options.ttl
        });
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};

// Specific cache configurations for time management
export const timeDataCache = cacheMiddleware({
  ttl: 300, // 5 minutes
  key: (req) => {
    const { dataType, startDate, endDate, group, status, search } = req.query;
    return `time-data-${dataType}-${startDate}-${endDate}-${group}-${status}-${search}`;
  },
  condition: (req) => {
    // Only cache if date range is more than 1 day old (historical data)
    const { endDate } = req.query;
    if (!endDate) return false;
    
    const end = new Date(endDate as string);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    return end < oneDayAgo;
  }
});

export const usersCache = cacheMiddleware({
  ttl: 3600, // 1 hour
  key: () => 'active-users',
  condition: () => true // Always cache users list
});

export const analyticsCache = cacheMiddleware({
  ttl: 1800, // 30 minutes
  key: (req) => {
    const { startDate, endDate, group } = req.query;
    return `analytics-${startDate}-${endDate}-${group}`;
  },
  condition: (req) => {
    // Cache analytics for historical data
    const { endDate } = req.query;
    if (!endDate) return false;
    
    const end = new Date(endDate as string);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return end < yesterday;
  }
});

// Cache invalidation utilities
export const invalidateCache = (pattern?: string) => {
  if (!pattern) {
    // Clear all cache
    cache.clear();
    return;
  }

  // Clear cache entries matching pattern
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};

// Invalidate time-related cache when data changes
export const invalidateTimeCache = () => {
  invalidateCache('time-data');
  invalidateCache('analytics');
};

export default cacheMiddleware;