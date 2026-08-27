package il.co.soline.measure.ui.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.catalog.FieldNote
import il.co.soline.measure.catalog.NoteRole
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal

/*
 * פילטר-טקסט להערות לפי ייעוד (wishlist §6): מודד / מפעל / תצוגה.
 * צ'יפים ניתנים-לבחירה מרובה; הרשימה למטה מציגה רק הערות בייעודים שנבחרו.
 */

/**
 * סרגל-סינון הערות + רשימת ההערות המסוננות.
 *
 * @param notes          כל הערות-השטח.
 * @param selectedRoles  הייעודים הפעילים (ברירת-מחדל: כולם). ריק = הצג הכול.
 * @param onSelectionChange נקרא עם קבוצת-הייעודים החדשה בכל החלפת-צ'יפ.
 * @param modifier       modifier חיצוני.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteFilterBar(
    notes: List<FieldNote>,
    selectedRoles: Set<NoteRole> = NoteRole.entries.toSet(),
    onSelectionChange: (Set<NoteRole>) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val active = if (selectedRoles.isEmpty()) NoteRole.entries.toSet() else selectedRoles
    val visible = notes.filter { it.role in active }

    Column(modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("פילטר:", fontSize = 13.sp, color = Muted, fontWeight = FontWeight.SemiBold)
            NoteRole.entries.forEach { role ->
                val on = role in active
                FilterChip(
                    selected = on,
                    onClick = {
                        val next = active.toMutableSet()
                        if (on) next.remove(role) else next.add(role)
                        onSelectionChange(next)
                    },
                    label = { Text("${role.he} (${notes.count { it.role == role }})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Teal,
                        selectedLabelColor = Color.White,
                        labelColor = Ink,
                        containerColor = Color.White,
                    ),
                )
            }
        }

        Spacer(Modifier.height(4.dp))

        if (visible.isEmpty()) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                Text("אין הערות בפילטר הנבחר", color = Muted, fontSize = 14.sp)
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                visible.forEach { note -> NoteCard(note) }
            }
        }
    }
}

@Composable
private fun NoteCard(note: FieldNote) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
            Box(
                Modifier
                    .background(roleColor(note.role).copy(alpha = 0.15f), RoundedCornerShape(50))
                    .padding(horizontal = 10.dp, vertical = 3.dp),
            ) {
                Text(note.role.he, fontSize = 11.sp, color = roleColor(note.role), fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(10.dp))
            Text(note.text, fontSize = 14.sp, color = Ink, modifier = Modifier.weight(1f))
        }
    }
}

private fun roleColor(role: NoteRole): Color = when (role) {
    NoteRole.SURVEYOR -> Teal
    NoteRole.FACTORY -> Orange
    NoteRole.DISPLAY -> Muted
}
