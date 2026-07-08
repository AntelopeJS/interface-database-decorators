import { MakePropertyDecorator } from "@antelopejs/interface-core/decorators";
import { getMetadata } from "./common";
import type { Table } from "./table";

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
   * The decorated field holds multiple target keys (one-to-many).
   */
  many?: boolean;
}

/**
 * Relation Metadata.
 */
export class RelationStaticMetadata {
  public static key = Symbol();

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
