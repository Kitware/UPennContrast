/* eslint-disable no-param-reassign,func-names */

import Mousetrap from "mousetrap";
import { isArray } from "lodash";

function bind(el: any, value: any, bindElement: any) {
  const mousetrap = new Mousetrap(bindElement ? el : undefined);
  el.mousetrap = mousetrap;
  if (!isArray(value)) {
    value = [value];
  }
  value.forEach(
    ({
      bind: _bind,
      handler,
      disabled
    }: {
      bind: any;
      handler: any;
      disabled: boolean;
    }) => {
      if (!disabled) {
        mousetrap.bind(_bind, function(this: any, ...args) {
          handler.apply(this, [el, ...args]);
        });
      }
    }
  );
}

function unbind(el: any) {
  el.mousetrap.reset();
}

export default function install(Vue: any) {
  Vue.directive("mousetrap", {
    inserted(el: any, { value, modifiers }: { value: any; modifiers: any }) {
      bind(el, value, modifiers.element);
    },
    update(el: any, { value, modifiers }: { value: any; modifiers: any }) {
      unbind(el);
      bind(el, value, modifiers.element);
    },
    unbind(el: any) {
      unbind(el);
    }
  });
}
