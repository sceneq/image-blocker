HARS := $(wildcard *.har)
HTMLS := $(HARS:.har=.html)

gen: $(HTMLS)

%.html: %.har
	./har2html.py < $< > tmp/$@
