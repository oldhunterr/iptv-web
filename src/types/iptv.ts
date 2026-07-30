export type SectionType = 'live' | 'vod' | 'series' | 'favorites' | 'history' | 'movies';
export type AppSection = SectionType;
export type ViewMode = 'grid' | 'list';
export type SortOption = 'default' | 'name_asc' | 'name_desc' | 'rating_desc' | 'added_desc';

export interface Category {
  category_id: string;
  category_name: string;
  parent_id?: number;
  count?: number;
  type?: 'live' | 'vod' | 'series';
}

export interface LiveChannel {
  num?: number;
  name: string;
  stream_id: number | string;
  stream_icon?: string;
  epg_channel_id?: string;
  added?: string;
  category_id: string;
  custom_sid?: string;
  tv_archive?: number;
  direct_source?: string;
  tv_archive_duration?: number;
  rating?: string | number;
}

export type LiveStream = LiveChannel;

export interface VodMovie {
  num?: number;
  name: string;
  stream_id: number | string;
  stream_icon?: string;
  rating?: string | number;
  rating_5based?: number;
  added?: string;
  category_id: string;
  container_extension?: string;
  custom_sid?: string;
  direct_source?: string;
  plot?: string;
  genre?: string;
  release_date?: string;
  director?: string;
  cast?: string;
  duration_secs?: number;
}

export type VodStream = VodMovie;

export interface VodInfo {
  info?: {
    tmdb_id?: string | number;
    name?: string;
    plot?: string;
    genre?: string;
    release_date?: string;
    director?: string;
    cast?: string;
    duration_secs?: number;
    rating?: string | number;
    movie_image?: string;
    backdrop_path?: string[];
  };
  movie_data?: {
    stream_id?: number | string;
    container_extension?: string;
    name?: string;
  };
}

export interface Series {
  num?: number;
  name: string;
  series_id: number | string;
  cover?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  last_modified?: string;
  rating?: string | number;
  rating_5based?: number;
  backdrop_path?: string[];
  youtube_trailer?: string;
  episode_run_time?: string;
  category_id: string;
}

export interface EpisodeInfo {
  duration?: string;
  duration_secs?: number;
  plot?: string;
  rating?: number | string;
  release_date?: string;
  cover_big?: string;
  movie_image?: string;
  tmdb_id?: string | number;
}

export interface Episode {
  id: string | number;
  episode_num: number;
  season_num?: number;
  title: string;
  container_extension?: string;
  info?: EpisodeInfo;
  custom_sid?: string;
  added?: string;
  cover_big?: string;
}

export interface SeriesInfo {
  info?: {
    name?: string;
    cover?: string;
    plot?: string;
    cast?: string;
    director?: string;
    genre?: string;
    releaseDate?: string;
    rating?: string | number;
    backdrop_path?: string[];
    youtube_trailer?: string;
    episode_run_time?: string;
  };
  seasons?: Array<{
    air_date?: string;
    episode_count?: number;
    id?: number;
    name?: string;
    overview?: string;
    poster_path?: string;
    season_number?: number;
  }>;
  episodes?: Record<string, Episode[]>;
}

export interface EpgProgram {
  id: string | number;
  channel_id: string | number;
  title: string;
  start: string;
  stop: string;
  start_timestamp: number;
  stop_timestamp: number;
  description?: string;
  category?: string;
  lang?: string;
}

export interface SkipTimestampSegment {
  start: number;
  end: number;
}

export interface SkipTimestamps {
  intro?: SkipTimestampSegment;
  recap?: SkipTimestampSegment;
  credits?: SkipTimestampSegment;
}

export interface CatalogItem {
  id: string | number;
  title: string;
  type: 'live' | 'vod' | 'series' | 'movies';
  poster?: string;
  category_id: string;
  rating?: string | number;
  rating_5based?: number | string;
  added?: string;
  container_extension?: string;
  plot?: string;
  genre?: string;
  name?: string;
  stream_id?: string | number;
  series_id?: string | number;
  stream_icon?: string;
  cover?: string;
  tmdb_id?: string | number;
  info?: any;
  cast?: string;
  director?: string;
  releaseDate?: string;
  release_date?: string;
  backdrop_path?: string[] | string;
  raw?: LiveChannel | VodMovie | Series;
}

export interface FavoriteItem {
  key: string;
  id: string | number;
  section: "live" | "movies" | "series";
  title: string;
  poster?: string;
  rating?: string;
  item: CatalogItem;
  addedAt: number;
}

export interface WatchHistoryItem {
  key: string;
  id: string | number;
  section: "live" | "movies" | "series";
  title: string;
  poster?: string;
  backdrop?: string;
  lastPosition: number;
  duration: number;
  updatedAt: number;
  streamUrl?: string;
  streamId?: string | number;
  containerExtension?: string;
  seriesId?: string | number;
  seasonNum?: number;
  episodeNum?: number;
  tvdbId?: string | number;
  tmdbId?: string | number;
}

export function normalizeCatalogItem(
  item: LiveChannel | VodMovie | Series | CatalogItem,
  type: 'live' | 'vod' | 'series' | 'movies'
): CatalogItem {
  if ('type' in item && item.id && item.title) {
    return item as CatalogItem;
  }

  if (type === 'live') {
    const channel = item as LiveChannel;
    return {
      id: channel.stream_id,
      title: channel.name,
      name: channel.name,
      type: 'live',
      poster: channel.stream_icon,
      stream_icon: channel.stream_icon,
      stream_id: channel.stream_id,
      category_id: channel.category_id,
      rating: channel.rating,
      added: channel.added,
      container_extension: 'ts',
      raw: channel,
    };
  } else if (type === 'vod' || type === 'movies') {
    const movie = item as VodMovie;
    return {
      id: movie.stream_id,
      title: movie.name,
      name: movie.name,
      type: type === 'movies' ? 'movies' : 'vod',
      poster: movie.stream_icon,
      stream_icon: movie.stream_icon,
      stream_id: movie.stream_id,
      category_id: movie.category_id,
      rating: movie.rating,
      added: movie.added,
      container_extension: movie.container_extension || 'mp4',
      plot: movie.plot,
      genre: movie.genre,
      raw: movie,
    };
  } else {
    const s = item as Series;
    return {
      id: s.series_id,
      title: s.name,
      name: s.name,
      type: 'series',
      poster: s.cover,
      cover: s.cover,
      series_id: s.series_id,
      category_id: s.category_id,
      rating: s.rating,
      added: s.last_modified,
      plot: s.plot,
      genre: s.genre,
      raw: s,
    };
  }
}
