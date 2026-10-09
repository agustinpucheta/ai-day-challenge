<script setup lang="ts">
import { computed } from 'vue';
import { storyPointsDeviation } from '@/issues/format';

const props = defineProps<{ final: number | null; planned: number | null }>();

const deviation = computed(() => storyPointsDeviation(props.final, props.planned));
</script>

<template>
  <dl class="stats" aria-label="Story points">
    <div class="stats__item" data-testid="sp-final">
      <dt>Final (consumed)</dt>
      <dd>
        <span v-if="final !== null" class="stats__value">{{ final }}</span>
        <span v-else class="muted">Not estimated</span>
        <span v-if="deviation" class="badge badge--warning">{{ deviation }}</span>
      </dd>
    </div>
    <div class="stats__item" data-testid="sp-planned">
      <dt>Planned</dt>
      <dd>
        <span v-if="planned !== null" class="stats__value">{{ planned }}</span>
        <span v-else class="muted">Not estimated</span>
      </dd>
    </div>
  </dl>
</template>
