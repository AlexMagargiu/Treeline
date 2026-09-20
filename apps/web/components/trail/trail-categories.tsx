import { Tags } from 'lucide-react';
import type { ReactNode } from 'react';

import type { RouteCategory } from '@/lib/api';

import { readable } from './edit-field';

/**
 * What kind of thing this route is, which is a list and not a column.
 *
 * `route_category` is empty for all 185 rows, so today this is the empty state and nothing
 * else. Categories arrive with the OpenStreetMap import in phase 2, and the same line can
 * be `hiking` in July and `snowshoe` in February, which is why the table is many to many
 * and why nothing here tries to guess one from the terrain.
 */
export function TrailCategories({ categories }: { categories: RouteCategory[] }): ReactNode {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <Tags aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
        <h4 className="mt-3 font-medium">No category yet</h4>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Nothing in the catalogue says whether this is a walk, a scramble or a winter
          route. The import fills these in, and a wrong guess here would be worse than the
          gap.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <li
          key={category.category}
          className={`inline-flex min-h-8 items-center rounded-sm border px-2 text-sm ${
            category.isPrimary ? 'border-primary text-foreground' : 'text-muted-foreground'
          }`}
        >
          {readable(category.category)}
        </li>
      ))}
    </ul>
  );
}
