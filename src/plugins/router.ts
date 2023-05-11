import Vue from "vue";
import Component from "vue-class-component";
import VueRouter from "vue-router";

Vue.use(VueRouter);

Component.registerHooks([
  "beforeRouteEnter",
  "beforeRouteUpdate" // for vue-router 2.2+
]);
