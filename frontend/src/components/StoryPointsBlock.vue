<script setup lang="ts">
import { es } from '@/i18n/es';
import StoryPointsInline from './StoryPointsInline.vue';

/** The story points of a detail page: large fields plus the deviation hint. */
defineProps<{ final: number | null; planned: number | null }>();
</script>

<template>
  <StoryPointsInline
    :planned="planned"
    :final="final"
    size="lg"
    :final-label="es.storyPoints.finalConsumed"
    show-deviation
  />
</template>
