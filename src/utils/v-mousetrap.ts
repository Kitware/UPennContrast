import Mousetrap from "mousetrap";
import { isArray } from "lodash";
import { reactive } from "vue";
import { Vue } from "vue-property-decorator";

export interface IHotkey {
  bind: string;
  handler: Function;
  disabled?: boolean;
  data?: IHotkeyDescription;
}

export interface IHotkeyDescription {
  section: string;
  description: string;
}

export const boundKeys: { [hotkey: string]: IHotkeyDescription } = reactive({});

function bind(el: any, value: IHotkey | IHotkey[], bindElement: any) {
  const mousetrap = new Mousetrap(bindElement ? el : undefined);
  el.mousetrap = mousetrap;
  if (!isArray(value)) {
    value = [value];
  }
  el.mousetrapValues = value;
  value.forEach(({ bind: _bind, handler, disabled, data }: IHotkey) => {
    if (disabled) {
      return;
    }
    mousetrap.bind(_bind, function (this: any, ...args) {
      handler.apply(this, [el, ...args]);
    });
    if (data) {
      Vue.set(boundKeys, _bind, data);
    }
  });
}

function unbind(el: any) {
  el.mousetrap.reset();
  el.mousetrapValues.forEach(({ bind: _bind, data }: IHotkey) => {
    if (data) {
      Vue.delete(boundKeys, _bind);
    }
  });
}

export default function install(Vue: any) {
  Vue.directive("mousetrap", {
    inserted(
      el: any,
      { value, modifiers }: { value: IHotkey | IHotkey[]; modifiers: any },
    ) {
      bind(el, value, modifiers.element);
    },
    update(
      el: any,
      { value, modifiers }: { value: IHotkey | IHotkey[]; modifiers: any },
    ) {
      unbind(el);
      bind(el, value, modifiers.element);
    },
    unbind(el: any) {
      unbind(el);
    },
  });
}
