<script setup>
const props = defineProps({
  user: { type: Object, default: null },
  size: { type: Number, default: 30 },
})
function initials(u) {
  if (!u) return '?'
  const name = u.full_name || u.username || '?'
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}
</script>

<template>
  <span
    class="avatar"
    :style="{
      width: size + 'px', height: size + 'px',
      background: user?.avatar_color || '#c7c7d6',
      fontSize: size * 0.38 + 'px',
    }"
    :title="user?.full_name"
  >{{ initials(user) }}</span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 700;
  flex: none;
  letter-spacing: 0.02em;
  user-select: none;
}
</style>
