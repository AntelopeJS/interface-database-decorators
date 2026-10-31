import { MakePropertyDecorator } from "@antelopejs/interface-core/decorators";

import type { Table } from "./table";
import { getMetadata } from "./common";

/**
 * Options for the {@link Relation} decorator.
 */
export interface RelationOptions {
  /**
   * Thunk returning the target Table class (lazy to allow forward references).
   */
  to: () => typeof Table;
  /**
   * Field on the target table the relation points to. Defaults to the target
   * table's primary key.
   */
  toField?: string;
  /**
   * The decorated field holds multiple target keys (many targets per source
   * record).
   */
  many?: boolean;
}

/**
 * Relation Metadata.
 */
export class RelationStaticMetadata {
  public static key = Symbol.for(
    "@antelopejs/interface-database-decorators/RelationStaticMetadata@1",
  );

  /**
   * The metadata of a subclass of a table: a copy of its parent's, so that
   * relations declared on the subclass never reach the parent or its siblings.
   */
  public static inherit(
    parent: RelationStaticMetadata,
  ): RelationStaticMetadata {
    const copy = new RelationStaticMetadata();
    for (const [field, options] of Object.entries(parent.relations)) {
      copy.relations[field] = options;
    }
    return copy;
  }

  public readonly relations: Record<string, RelationOptions> = {};
}

/**
 * Database Table Relation decorator.
 *
 * Declarative metadata only: database implementations do not enforce it (no
 * foreign key constraint, no referential validation). It is consumed by
 * introspection tooling to expose the links between tables.
 *
 * Available options:
 * - `to`: Thunk returning the target Table class.
 * - `toField`: Target field name (defaults to the target's primary key).
 * - `many`: Whether the field holds multiple target keys.
 *
 * @param options Options
 */
export const Relation = MakePropertyDecorator(
  (target, propertyKey, options: RelationOptions) => {
    const metadata = getMetadata(target.constructor, RelationStaticMetadata);
    metadata.relations[String(propertyKey)] = options;
  },
);
