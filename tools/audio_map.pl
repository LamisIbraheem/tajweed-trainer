#!/usr/bin/perl
# Maps every example in js/data.js to an ayah + word range, then to a clip of
# al-Husary's murattal recitation (quran.com recitation id 6) using its word timings.
# Usage: perl audio_map.pl <data.js> <tanzil q.json> <out audio.js> <cache dir>
use strict; use warnings; use utf8;
use JSON::PP;
binmode STDOUT, ':utf8'; binmode STDERR, ':utf8';
my ($datajs, $qjson, $out, $cache) = @ARGV;
mkdir $cache unless -d $cache;

sub slurp { my $f = shift; open my $h, '<:raw', $f or die "$f: $!"; local $/; my $s = <$h>; close $h; $s }
use Unicode::Normalize qw(NFD);
sub norm {
  my ($s, $keep_vowels) = @_;
  $s = NFD($s);   # same order for stacked marks (shaddah + fatha typed either way)
  $s =~ s/[{}|]//g;
  if ($keep_vowels) {
    # Keep fatha/damma/kasra, tanween and shaddah (homographs like تَبَّتْ / تُبْتُ differ only here);
    # drop sukun, dagger alif, Quranic annotation marks and tatweel, whose use varies between texts.
    $s =~ s/[\x{0652}-\x{065F}\x{0670}\x{06D6}-\x{06ED}\x{0640}]//g;
  } else {
    $s =~ s/[\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}\x{0640}]//g;
  }
  $s =~ tr/\x{0622}\x{0623}\x{0625}\x{0671}\x{0649}/\x{0627}\x{0627}\x{0627}\x{0627}\x{064A}/;
  $s =~ s/^\s+|\s+$//g; $s =~ s/\s+/ /g;
  return $s;
}
sub fetch_json {
  my ($url, $file) = @_;
  my $path = "$cache/$file";
  unless (-s $path) { system('curl', '-s', '-m', '30', '-o', $path, $url) == 0 or die "fetch $url"; select(undef, undef, undef, 0.15); }
  return decode_json(slurp($path));
}
# Match example tokens inside an ayah's tokens. Returns (start, end) token indices or ().
# The first example token may follow a prefix (و ف ب ل…); the last may be followed by a suffix.
sub find_seq {
  my ($ayah, $ex, $want_end) = @_;
  my @hits;
  for my $i (0 .. @$ayah - @$ex) {
    my $ok = 1;
    for my $k (0 .. $#$ex) {
      my ($a, $e) = ($ayah->[$i + $k], $ex->[$k]);
      if (@$ex == 1) { $ok = 0 unless index($a, $e) >= 0; }
      elsif ($k == 0) { $ok = 0 unless $a =~ /\Q$e\E$/; }
      elsif ($k == $#$ex) { $ok = 0 unless $a =~ /^\Q$e\E/; }
      else { $ok = 0 unless $a eq $e; }
      last unless $ok;
    }
    next unless $ok;
    # Quality: 3 = exact words; 2 = only a prefix particle (و ف ب ل ك) before the first word; 1 = looser.
    my @got = @{$ayah}[$i .. $i + $#$ex];
    my $q = 1;
    if (join(' ', @got) eq join(' ', @$ex)) { $q = 3; }
    else {
      my @g = @got; $g[0] =~ s/^(?:\x{0648}|\x{0641}|\x{0628}|\x{0644}|\x{0643}|\x{0627}\x{0644})(?=\Q$ex->[0]\E$)//;
      $q = 2 if join(' ', @g) eq join(' ', @$ex);
    }
    my $atEnd = ($i + $#$ex == $#$ayah) ? 1 : 0;
    push @hits, [$i, $i + $#$ex, $q, $atEnd];
  }
  return () unless @hits;
  # Stop examples must end the ayah (natural stop); otherwise prefer matches not at the end.
  @hits = grep { $_->[3] } @hits if $want_end;
  return () unless @hits;
  @hits = sort { $b->[2] <=> $a->[2] || ($want_end ? 0 : $a->[3] <=> $b->[3]) } @hits;
  return @{$hits[0]}[0, 1, 2];
}

my $src = slurp($datajs); utf8::decode($src);
my @examples;
while ($src =~ /examples:\s*\[(.*?)\]/gs) { my $list = $1; push @examples, $1 while $list =~ /"((?:[^"\\]|\\.)*)"/g; }
my %seen; @examples = grep { !$seen{$_}++ } @examples;

my $q = decode_json(slurp($qjson));
my @ayahs;
for my $s (@{$q->{data}{surahs}}) { for my $a (@{$s->{ayahs}}) {
  my $t = $a->{text}; $t =~ s/^\x{FEFF}//;
  push @ayahs, { key => "$s->{number}:$a->{numberInSurah}", s => $s->{number}, a => $a->{numberInSurah},
                 tok => [split / /, norm($t)], vtok => [split / /, norm($t, 1)] };
}}

my (%map, @fail);
for my $ex (@examples) {
  my $stop = $ex =~ /\|$/ ? 1 : 0;
  my @et = split / /, norm($ex);
  my @vet = split / /, norm($ex, 1);
  my ($hit, $range);
  # Best-quality match anywhere in the Quran, first with vowels, then on bare letters; earliest ayah wins a tie.
  for my $pass (['vtok', \@vet], ['tok', \@et]) {
    my ($field, $pat) = @$pass;
    for my $ay (@ayahs) {
      my @r = find_seq($ay->{$field}, $pat, $stop);
      if (@r && (!$range || $r[2] > $range->[2])) { ($hit, $range) = ($ay, \@r); last if $r[2] == 3; }
    }
    last if $range && $range->[2] >= 2;
  }
  unless ($hit) { push @fail, "$ex (no ayah)"; next; }
  # Word positions in quran.com's own word list (a word can hold two tokens, e.g. يا ايها).
  my $v = fetch_json("https://api.quran.com/api/v4/verses/by_key/$hit->{key}?words=true&word_fields=text_imlaei_simple", "v_$hit->{s}_$hit->{a}.json");
  my (@qt, @qpos);
  for my $w (@{$v->{verse}{words}}) { next unless $w->{char_type_name} eq 'word'; for my $t (split / /, norm($w->{text_imlaei_simple})) { push @qt, $t; push @qpos, $w->{position}; } }
  my @r = find_seq(\@qt, \@et, $stop);
  # quran.com's simple spelling sometimes differs (ذالك، الرحمان); when both texts split the ayah
  # into the same number of words, reuse the position found in the tanzil text.
  @r = @$range[0, 1] if !@r && @qt == @{$hit->{tok}};
  unless (@r) { push @fail, "$ex ($hit->{key}: no word match)"; next; }
  my ($w1, $w2) = ($qpos[$r[0]], $qpos[$r[1]]);
  my $rec = fetch_json("https://api.quran.com/api/v4/recitations/6/by_ayah/$hit->{key}?fields=segments", "r_$hit->{s}_$hit->{a}.json");
  my $af = $rec->{audio_files}[0];
  my %seg = map { $_->[1] => $_ } @{$af->{segments} || []};
  unless ($seg{$w1} && $seg{$w2}) { push @fail, "$ex ($hit->{key}: no timing for words $w1-$w2)"; next; }
  (my $file = $af->{url}) =~ s{^.*/}{};
  $map{$ex} = [$file, $seg{$w1}[2], $seg{$w2}[3], $hit->{key}];
  printf "%-28s %-7s w%d-%d %d-%dms\n", $ex, $hit->{key}, $w1, $w2, $seg{$w1}[2], $seg{$w2}[3];
}

my $json = JSON::PP->new->canonical->utf8(0);
open my $o, '>:utf8', $out or die $!;
print $o "// Audio clips for lesson/quiz examples: [ayah file, start ms, end ms, surah:ayah].\n";
print $o "// Recitation: Mahmoud Khalil al-Husary (murattal, Hafs), via quran.com / everyayah.com. Generated by audio_map.pl.\n";
print $o "window.TAJWEED_AUDIO = { base: \"https://mirrors.quranicaudio.com/everyayah/Husary_64kbps/\", clips: {\n";
my @keys = grep { exists $map{$_} } @examples;
print $o join(",\n", map { "  " . $json->encode($_) . ": " . $json->encode($map{$_}) } @keys), "\n} };\n";
close $o;
print STDERR scalar(@keys), " of ", scalar(@examples), " examples mapped\n";
print STDERR "FAILED: $_\n" for @fail;
