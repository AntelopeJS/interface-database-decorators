import { MakePropertyDecorator } from "@antelopejs/interface-core/decorators";
import { attachModifier, Modifier } from "./common";

type AutoDateType = "created" | "updated";

type Options = {
  /** Timestamp behavior: `created` is only set on insert, `updated` is refreshed on every update */
  type: AutoDateType;
};

/**
 * Auto-date modifier. Enables the use of {@link CreationTime} and
 * {@link UpdateTime} on table fields.
 *
 * This is an event-only modifier: it does not transform stored values and
 * does not require the Table class to incorporate a mixin.
 */
export class AutoDateModifier extends Modifier<object, Options> {
  public insert(object: Record<string, unknown>, field: string) {
    object[field] = new Date();
  }

  public update(object: Record<string, unknown>, field: string) {
    if (this.options.type === "updated") {
      object[field] = new Date();
    } else {
      delete object[field];
    }
  }
}

/**
 * Mark a Database Table class field as an automatic creation timestamp.
 *
 * The field is set to the current date on insert and removed from update
 * payloads so the original creation date is preserved.
 */
export const CreationTime = MakePropertyDecorator((target, propertyKey) => {
  attachModifier(target.constructor, AutoDateModifier, propertyKey, {
    type: "created",
  });
});

/**
 * Mark a Database Table class field as an automatic update timestamp.
 *
 * The field is set to the current date on insert and refreshed on every
 * update.
 */
export const UpdateTime = MakePropertyDecorator((target, propertyKey) => {
  attachModifier(target.constructor, AutoDateModifier, propertyKey, {
    type: "updated",
  });
});
