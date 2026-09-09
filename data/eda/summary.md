# EDA summary
Raw cleaned rows (sections + OVERALL): 270,262
Gradeable section rows (has avg, not OVERALL): 141,556
Feature-table rows (also enrolled >= 10): 118,507
Year range: 1996-2016

## Rows per year-session
year  session
1996  S          1041
      W          5774
1997  S          1051
      W          5837
1998  S          1075
      W          5855
1999  S          1086
      W          5780
2000  S          1100
      W          5859
2001  S          1135
      W          6071
2002  S          1181
      W          6451
2003  S          1183
      W          6700
2004  S          1196
      W          6831
2005  S          1206
      W          6894
2006  S          1229
      W          6871
2007  S          1218
      W          6765
2008  S          1260
      W          6955
2009  S          1285
      W          7140
2010  S          1313
      W          7258
2011  S          1304
      W          7209
2012  S          1270
      W          7299
2013  S          1226
      W          7306
2014  S          1201
      W          7356
2015  S          1250
      W          7480
2016  S          1271
      W          7641

## Missingness (gradeable-eligible section rows, before enrolled>=10 filter)
avg          0.149369
std_dev      0.149369
fail_rate    0.000000

Most missing avg/std_dev rows are tiny sections (labs/tutorials/BCS with <10
enrolled) that PAIR privacy-suppresses or that never had letter grades issued.

## avg / fail_rate / std_dev summary (gradeable rows)
                 avg      fail_rate        std_dev       enrolled
count  141556.000000  141556.000000  141556.000000  141556.000000
mean       78.258391       0.022942       8.873867      41.432098
std         7.889012       0.048656       5.702609      50.203659
min         0.000000       0.000000       0.000000       4.000000
25%        72.970000       0.000000       4.720000      13.000000
50%        78.090000       0.000000       7.780000      26.000000
75%        84.200000       0.028571      11.960000      47.000000
max       100.000000       1.000000      61.520000    1276.000000

## Top 15 hardest subjects by mean difficulty_score (>=30 offerings)
              mean  count
subject                  
MATH     85.506901   4468
BUSI     81.534945   1843
LATN     78.950018    210
VANT     75.985653     88
WRDS     73.060237    221
FNSP     71.227527     62
NEST     71.149231     94
CHEM     70.705820   2049
ASTR     70.571647    231
ASTU     70.341735    602
ARCL     70.318446     41
PSYC     70.049916   3300
ITAL     69.038056    351
ITST     67.602412     83
PHIL     67.540298   2094

## Top 15 easiest subjects by mean difficulty_score (>=30 offerings)
              mean  count
subject                  
CCFI      4.697726     67
CELL      5.141183     37
EADM      8.344046    248
ZOOL      8.431368     67
PLAN      8.934239    622
VRHC      8.951264     32
EDCP      9.407722    434
BOTA     10.118438     35
EDCI     11.119026    196
PHTH     12.136713    100
CUST     12.659567    281
RSPT     13.229471    258
RSOT     14.150608    258
EPSE     14.512120   2200
SPPH     14.514798    347

## Feature missingness in the final feature table
hist_course_mean_difficulty       0.072713
hist_course_offerings_count       0.000000
hist_course_mean_enrolled         0.072713
hist_subject_mean_difficulty      0.002481
hist_subject_offerings_count      0.000000
hist_professor_mean_difficulty    0.520180
hist_professor_offerings_count    0.000000
global_running_mean_difficulty    0.000008
